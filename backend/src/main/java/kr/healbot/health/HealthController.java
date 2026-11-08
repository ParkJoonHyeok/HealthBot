package kr.healbot.health;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
@RestController
public class HealthController {
    private final HealthService service;
    public HealthController(HealthService service) { this.service = service; }
    @GetMapping("/api/health")
    public ResponseEntity<Map<String, String>> health() {
        return service.ready() ? ResponseEntity.ok(Map.of("status", "ok"))
            : ResponseEntity.status(503).body(Map.of("status", "unavailable"));
    }
}
