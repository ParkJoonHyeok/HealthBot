package kr.healbot.web;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.*;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.*;
import static org.assertj.core.api.Assertions.*;
class ApiGuardFilterTest {
    @Test void limitsCannotBeBypassedWithForwardedHeadersAndHealthIsExcluded() throws Exception {
        var filter=new ApiGuardFilter(new ObjectMapper(),Clock.fixed(Instant.EPOCH,ZoneOffset.UTC),1);
        for(int i=0;i<2;i++) {
            var request=new MockHttpServletRequest("GET","/api/hospitals");request.setRemoteAddr("127.0.0.1");request.addHeader("X-Forwarded-For","1.2.3."+i);
            var response=new MockHttpServletResponse();filter.doFilter(request,response,new MockFilterChain());
            assertThat(response.getStatus()).isEqualTo(i==0?200:429);
            if(i==1)assertThat(response.getHeader("Retry-After")).isEqualTo("60");
        }
        var health=new MockHttpServletResponse();filter.doFilter(new MockHttpServletRequest("GET","/api/health"),health,new MockFilterChain());assertThat(health.getStatus()).isEqualTo(200);
    }

    @Test void decodedPathsShareQuotaAndWindowExpires() throws Exception {
        var clock=org.mockito.Mockito.mock(Clock.class);
        org.mockito.Mockito.when(clock.millis()).thenReturn(0L,0L,60000L);
        var filter=new ApiGuardFilter(new ObjectMapper(),clock,1);
        for(int i=0;i<3;i++) {
            var request=new MockHttpServletRequest("GET",i==1?"/api/%68ospitals":"/api/hospitals");
            request.setServletPath("/api/hospitals");request.setRemoteAddr("127.0.0.1");
            var response=new MockHttpServletResponse();filter.doFilter(request,response,new MockFilterChain());
            assertThat(response.getStatus()).isEqualTo(i==1?429:200);
        }
    }
}
