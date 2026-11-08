package kr.healbot.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.*;
import java.time.Clock;
import java.util.*;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class ApiGuardFilter extends OncePerRequestFilter {
    private record Window(int count,long expires) {}
    private final Map<String,Window> windows=new HashMap<>();
    private final Clock clock;
    private final ObjectMapper json;
    private final int limit;
    private long nextCleanup;
    @org.springframework.beans.factory.annotation.Autowired
    public ApiGuardFilter(ObjectMapper json) { this(json,Clock.systemUTC(),30); }
    ApiGuardFilter(ObjectMapper json,Clock clock,int limit) { this.json=json;this.clock=clock;this.limit=limit; }
    private synchronized int retryAfter(String key) {
        long time=clock.millis();
        if(time>=nextCleanup) { windows.values().removeIf(entry->entry.expires()<=time);nextCleanup=time+1000; }
        Window entry=windows.get(key);
        if(entry!=null && entry.expires()<=time) {windows.remove(key);entry=null;}
        if(entry==null) { if(windows.size()>=10000)return 60; entry=new Window(0,time+60000); }
        if(entry.count()>=limit)return Math.max(1,(int)Math.ceil((entry.expires()-time)/1000.0));
        windows.put(key,new Window(entry.count()+1,entry.expires()));return 0;
    }
    private void error(HttpServletResponse response,int status,Object body) throws IOException {
        response.setStatus(status);response.setContentType("application/json");response.setCharacterEncoding("UTF-8");json.writeValue(response.getOutputStream(),body);
    }
    @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain) throws ServletException,IOException {
        response.setHeader("X-Content-Type-Options","nosniff");
        response.setHeader("Referrer-Policy","no-referrer");
        response.setHeader("Cache-Control","no-store");
        response.setHeader("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
        String path=request.getServletPath().isEmpty()?request.getRequestURI():request.getServletPath();
        boolean guide=path.equals("/api/guide") && request.getMethod().equals("POST");
        boolean hospitals=path.equals("/api/hospitals") && request.getMethod().equals("GET");
        if(guide || hospitals) {
            int retry=retryAfter(request.getRemoteAddr()+":"+path);
            if(retry>0) {response.setHeader("Retry-After",String.valueOf(retry));error(response,429,Map.of("error","요청이 많습니다. "+retry+"초 후 다시 시도해 주세요.","retryAfter",retry));return;}
        }
        if(guide) {
            byte[] bytes=request.getInputStream().readNBytes(8193);
            if(bytes.length>8192) {error(response,413,Map.of("error","입력 용량을 초과했습니다."));return;}
            var wrapped=new HttpServletRequestWrapper(request) {
                @Override public ServletInputStream getInputStream() {
                    var input=new ByteArrayInputStream(bytes);
                    return new ServletInputStream() {
                        @Override public int read() { return input.read(); }
                        @Override public boolean isFinished() {return input.available()==0;}
                        @Override public boolean isReady() {return true;}
                        @Override public void setReadListener(ReadListener listener) {throw new UnsupportedOperationException("Synchronous request body only");}
                    };
                }
            };
            chain.doFilter(wrapped,response);return;
        }
        chain.doFilter(request,response);
    }
}
