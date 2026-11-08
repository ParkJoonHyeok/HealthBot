package kr.healbot.guide;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.web.bind.annotation.*;

@RestController
public class GuideController {
    private final GuideService service;
    public GuideController(GuideService service) { this.service=service; }
    @PostMapping(value="/api/guide", consumes="application/json")
    public GuideService.Result guide(@RequestBody JsonNode body) {
        JsonNode symptoms = body == null ? null : body.get("symptoms");
        return service.guide(symptoms != null && symptoms.isTextual() ? symptoms.textValue() : null);
    }
}
