package kr.healbot.health;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
@Service
public class HealthService {
    private final HealthMapper mapper;
    public HealthService(HealthMapper mapper) { this.mapper = mapper; }
    @Transactional(readOnly = true)
    public boolean ready() { return mapper.ping() == 1; }
}
