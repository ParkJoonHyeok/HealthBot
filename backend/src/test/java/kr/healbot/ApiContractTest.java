package kr.healbot;
import kr.healbot.guide.*;
import kr.healbot.hospital.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest({GuideController.class,HospitalController.class})
@Import({GuideService.class,HospitalService.class})
@TestPropertySource(properties="HOSPITAL_DEMO=true")
class ApiContractTest {
    @Autowired MockMvc http;
    @MockitoBean HospitalHttpClient provider;
    @Test void guideValidatesJsonTypeAndLength() throws Exception {
        for(String input:new String[]{"{}","[]","null","{\"symptoms\":3}","{\"symptoms\":\" \"}"})
            http.perform(post("/api/guide").contentType("application/json").content(input)).andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").exists());
        http.perform(post("/api/guide").contentType("application/json").content("{")).andExpect(status().isBadRequest());
        http.perform(post("/api/guide").contentType("text/plain").content("기침")).andExpect(status().isUnsupportedMediaType());
        http.perform(post("/api/guide").contentType("application/json").content("가".repeat(3000))).andExpect(status().isPayloadTooLarge());
    }
    @Test void guideReturnsEmergencyWithoutRoutineMatches() throws Exception {
        http.perform(post("/api/guide").contentType("application/json").content("{\"symptoms\":\"기침과 호흡곤란\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.emergency").value(true)).andExpect(jsonPath("$.matches").isEmpty())
            .andExpect(header().string("X-Content-Type-Options","nosniff"));
    }
    @Test void hospitalFiltersAndPageValidationMatchPrototype() throws Exception {
        http.perform(get("/api/hospitals")).andExpect(status().isOk()).andExpect(jsonPath("$.mode").value("demo")).andExpect(jsonPath("$.total").value(1));
        http.perform(get("/api/hospitals?region=부산")).andExpect(status().isOk()).andExpect(jsonPath("$.items").isEmpty());
        for(String query:new String[]{"page=0","page=01","page=1x","region=constructor","department=응급실"})
            http.perform(get("/api/hospitals?"+query)).andExpect(status().isBadRequest());
    }
}
