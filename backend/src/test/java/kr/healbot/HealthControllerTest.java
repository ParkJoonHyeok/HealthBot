package kr.healbot;

import kr.healbot.health.HealthController;
import kr.healbot.health.HealthService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.CannotCreateTransactionException;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(HealthController.class)
class HealthControllerTest {
    @Autowired MockMvc http;
    @MockitoBean HealthService health;

    @Test void failedProbeReturnsUnavailable() throws Exception {
        when(health.ready()).thenReturn(false);
        http.perform(get("/api/health")).andExpect(status().isServiceUnavailable())
            .andExpect(content().json("{\"status\":\"unavailable\"}"));
    }

    @Test void dataAccessFailureDoesNotExposeConnectionDetails() throws Exception {
        when(health.ready()).thenThrow(new DataAccessResourceFailureException("private connection details"));
        http.perform(get("/api/health")).andExpect(status().isServiceUnavailable())
            .andExpect(content().string("{\"status\":\"unavailable\"}"));
    }

    @Test void transactionConnectionFailureReturnsUnavailable() throws Exception {
        when(health.ready()).thenThrow(new CannotCreateTransactionException("private connection details"));
        http.perform(get("/api/health")).andExpect(status().isServiceUnavailable())
            .andExpect(content().string("{\"status\":\"unavailable\"}"));
    }
}
