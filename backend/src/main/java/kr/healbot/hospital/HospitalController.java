package kr.healbot.hospital;
import org.springframework.web.bind.annotation.*;
@RestController
public class HospitalController {
    private final HospitalService service;
    public HospitalController(HospitalService service) {this.service=service;}
    @GetMapping("/api/hospitals")
    public HospitalService.Result search(@RequestParam(required=false) String region,@RequestParam(required=false) String department,@RequestParam(required=false) String page) {
        return service.search(HospitalService.validate(region,department,page));
    }
}
