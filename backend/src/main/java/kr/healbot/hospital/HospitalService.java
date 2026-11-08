package kr.healbot.hospital;

import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import kr.healbot.web.ApiException;

@Service
public class HospitalService {
    static final Map<String,String> REGIONS=Map.ofEntries(
        Map.entry("서울","110000"),Map.entry("부산","210000"),Map.entry("인천","220000"),Map.entry("대구","230000"),Map.entry("광주","240000"),Map.entry("대전","250000"),Map.entry("울산","260000"),Map.entry("경기","310000"),Map.entry("강원","320000"),Map.entry("충북","330000"),Map.entry("충남","340000"),Map.entry("전북","350000"),Map.entry("전남","360000"),Map.entry("경북","370000"),Map.entry("경남","380000"),Map.entry("제주","390000"),Map.entry("세종","410000"));
    static final Map<String,String> DEPARTMENTS=Map.of("내과","01","신경과","02","정형외과","05","소아청소년과","11","이비인후과","13","피부과","14","가정의학과","23");
    public record Query(String region,String department,int page) {}
    public record Hospital(String name,String address,String phone,String type) {}
    public record Page(long total,List<Hospital> items) {}
    public record Result(String mode,String source,int page,int pageSize,long total,List<Hospital> items) {}
    private final HospitalHttpClient client;
    private final String key;
    private final boolean demo;
    public HospitalService(HospitalHttpClient client,@Value("${HOSPITAL_API_KEY:}") String key,@Value("${HOSPITAL_DEMO:false}") boolean demo) {
        this.client=client;this.key=key;this.demo=demo;
    }
    public static Query validate(String region,String department,String page) {
        region=region==null || region.isEmpty()?"서울":region;
        department=department==null || department.isEmpty()?"내과":department;
        page=page==null || page.isEmpty()?"1":page;
        if(!REGIONS.containsKey(region)||!DEPARTMENTS.containsKey(department)||!page.matches("[1-9][0-9]{0,3}"))throw new ApiException(400,"지역, 진료과 또는 페이지 번호를 확인해 주세요.");
        return new Query(region,department,Integer.parseInt(page));
    }
    public Result search(Query query) {
        if(demo) {
            boolean found=query.region().equals("서울") && query.department().equals("내과");
            var items=found && query.page()==1?List.of(new Hospital("샘플 건강의원 (가상)","서울 샘플 주소 — 실제 병원이 아닙니다","","개발용 예시")):List.<Hospital>of();
            return new Result("demo","개발용 가상 데이터",query.page(),10,found?1:0,items);
        }
        if(key.isBlank())throw new ApiException(503,"병원 정보 연동이 아직 준비되지 않았습니다. 아래 지도 검색을 이용해 주세요.");
        var result=client.fetch(key,REGIONS.get(query.region()),DEPARTMENTS.get(query.department()),query.page());
        return new Result("live","건강보험심사평가원 병원정보서비스",query.page(),10,result.total(),result.items());
    }
}
