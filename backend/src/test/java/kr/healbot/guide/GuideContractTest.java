package kr.healbot.guide;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class GuideContractTest {
    @Test void matchesFrozenNodeResponses() throws Exception {
        var json=new ObjectMapper();var service=new GuideService();
        try(var input=getClass().getResourceAsStream("/contracts/guide.json")) {
            for(var fixture:json.readTree(input))assertThat(json.<com.fasterxml.jackson.databind.JsonNode>valueToTree(service.guide(fixture.get("symptoms").asText())))
                .as(fixture.get("symptoms").asText()).isEqualTo(fixture.get("result"));
        }
    }
    @Test void rejectsBlankUnicodeAndOversizedInput() {
        for(String input:new String[]{null," ","\u00a0\ufeff","가".repeat(1001)})assertThatThrownBy(()->new GuideService().guide(input)).isInstanceOf(kr.healbot.web.ApiException.class);
    }
}
