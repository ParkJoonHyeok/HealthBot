package kr.healbot.guide;

import java.util.List;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import kr.healbot.web.ApiException;

@Service
public class GuideService {
    record Rule(List<String> words, String department, List<String> topics) {}
    public record Match(String department, List<String> topics) {}
    public record Result(String mode, boolean emergency, String notice, List<Match> matches, String disclaimer) {}
    private static final Pattern EMERGENCY = Pattern.compile("가슴.*통증|흉통|숨.*(못|어려|차)|호흡곤란|의식|마비|말.*어눌|극심한.*두통|심한.*출혈");
    private static final List<Rule> RULES = List.of(
        new Rule(List.of("기침","콧물","인후통","목 아","발열"),"내과",List.of("감기 등 호흡기 질환","알레르기 관련 증상")),
        new Rule(List.of("복통","배가","설사","구토","속쓰림"),"내과",List.of("위장관 관련 질환")),
        new Rule(List.of("피부","가려","발진","두드러기"),"피부과",List.of("피부염 및 알레르기 관련 질환")),
        new Rule(List.of("허리","무릎","관절","발목"),"정형외과",List.of("근골격계 관련 질환")),
        new Rule(List.of("두통","어지러"),"신경과",List.of("두통 및 어지럼 관련 질환")),
        new Rule(List.of("귀","코막힘"),"이비인후과",List.of("귀·코 관련 질환"))
    );
    public Result guide(String symptoms) {
        if (symptoms == null || symptoms.replaceAll("^[\\s\\p{Z}\\uFEFF]+|[\\s\\p{Z}\\uFEFF]+$", "").length() < 2 || symptoms.length() > 1000)
            throw new ApiException(400,"증상을 2~1,000자로 입력해 주세요.");
        boolean emergency = EMERGENCY.matcher(symptoms).find();
        var matches = emergency ? List.<Match>of() : RULES.stream()
            .filter(rule -> rule.words().stream().anyMatch(symptoms::contains))
            .map(rule -> new Match(rule.department(),rule.topics())).toList();
        return new Result("rules",emergency,emergency
            ? "응급 징후와 관련된 표현이 감지되었습니다. 증상이 현재 발생 중이라면 즉시 119에 연락하거나 응급실을 방문하세요."
            : "응급 징후가 없다는 뜻은 아닙니다. 갑작스럽거나 심한 증상은 즉시 의료진에게 문의하세요.", matches,
            "키워드 기반 참고 정보이며 AI 분석이나 의학적 진단이 아닙니다. 실제 질환과 진료과는 의료진의 평가가 필요합니다.");
    }
}
