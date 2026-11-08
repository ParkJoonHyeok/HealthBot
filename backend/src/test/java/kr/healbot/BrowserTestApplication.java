package kr.healbot;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.springframework.boot.SpringApplication;

/** Test classpath only: temporary database for the same browser suite used by Node. */
public class BrowserTestApplication {
    public static void main(String[] args) throws Exception {
        if(!"true".equals(System.getenv("HOSPITAL_DEMO")))throw new IllegalStateException("Browser fixture requires HOSPITAL_DEMO=true");
        var postgres=EmbeddedPostgres.builder().setPort(0).start();
        System.setProperty("spring.datasource.url",postgres.getJdbcUrl("postgres","postgres"));
        System.setProperty("spring.datasource.username","postgres");System.setProperty("spring.datasource.password","");
        var app=new SpringApplication(HealBotApplication.class);app.setRegisterShutdownHook(false);
        try {
            var context=app.run(args);
            Runtime.getRuntime().addShutdownHook(new Thread(()->{context.close();try{postgres.close();}catch(Exception ignored){}}));
        }catch(Exception error){postgres.close();throw error;}
    }
}
