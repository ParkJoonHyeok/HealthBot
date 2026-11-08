package kr.healbot;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.io.IOException;
import java.util.Map;
import java.util.UUID;
import javax.sql.DataSource;
import kr.healbot.user.UserMapper;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class DatabaseIntegrationTest {
    private static final EmbeddedPostgres POSTGRES = startDatabase();
    private static final String HASH = "$2b$12$" + "A".repeat(53);
    @Autowired UserMapper users;
    @Autowired Flyway flyway;
    @Autowired DataSource dataSource;
    @Autowired PlatformTransactionManager transactions;
    @Autowired TestRestTemplate http;
    static EmbeddedPostgres startDatabase() {
        try { return EmbeddedPostgres.builder().setPort(0).start(); }
        catch (IOException error) { throw new ExceptionInInitializerError(error); }
    }
    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> POSTGRES.getJdbcUrl("postgres", "postgres"));
        registry.add("spring.datasource.username", () -> "postgres");
        registry.add("spring.datasource.password", () -> "");
    }
    @AfterAll static void stopDatabase() throws IOException { POSTGRES.close(); }
    @Test void healthUsesRealDatabaseThroughServiceAndMapper() {
        var response = http.getForEntity("/api/health", Map.class);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).containsEntry("status", "ok");
    }
    @Test void migrationIsAppliedOnceAndValidatesOnRerun() {
        flyway.validate();
        assertThat(flyway.migrate().migrationsExecuted).isZero();
        var jdbc = new JdbcTemplate(dataSource);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM flyway_schema_history WHERE success AND version='001'", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('app_user','hospital','post','comment','review','report')", Integer.class)).isEqualTo(6);
    }
    @Test void mapperBindsInputAndDatabaseRejectsDuplicateEmails() {
        String id = UUID.randomUUID().toString();
        users.insert(id, "Member@example.com", HASH, "회원");
        assertThat(users.findActiveIdByEmail("member@example.com")).isEqualTo(id);
        assertThat(users.findActiveIdByEmail("' OR 1=1 --")).isNull();
        assertThatThrownBy(() -> users.insert(UUID.randomUUID().toString(), "member@example.com", HASH, "중복")).isInstanceOf(DuplicateKeyException.class);
    }
    @Test void serviceTransactionRollsBackMapperWrites() {
        var transaction = new TransactionTemplate(transactions);
        assertThatThrownBy(() -> transaction.execute(status -> {
            users.insert(UUID.randomUUID().toString(), "rollback@example.com", HASH, "롤백");
            throw new IllegalStateException("simulate failure");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(users.findActiveIdByEmail("rollback@example.com")).isNull();
    }
}
