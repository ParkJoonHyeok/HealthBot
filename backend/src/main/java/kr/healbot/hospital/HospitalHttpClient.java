package kr.healbot.hospital;

import java.io.ByteArrayOutputStream;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.springframework.stereotype.Component;
import kr.healbot.web.ApiException;

@Component
public class HospitalHttpClient {
    private static final URI ENDPOINT=URI.create("https://apis.data.go.kr/B551182/hospInfoServicev2/getHospBasisList");
    private final URI endpoint;
    private final Proxy proxy;
    public HospitalHttpClient() {this(ENDPOINT,proxyFor(ENDPOINT,System.getenv()));}
    HospitalHttpClient(URI endpoint,Proxy proxy) {this.endpoint=endpoint;this.proxy=proxy;}
    static Proxy proxyFor(URI endpoint,Map<String,String> env) {
        String bypass=env.getOrDefault("NO_PROXY",env.getOrDefault("no_proxy",""));
        for(String token:bypass.split(",")) {
            String host=token.strip().toLowerCase();
            if(host.isEmpty())continue;
            if(host.equals("*"))return Proxy.NO_PROXY;
            if(host.startsWith("."))host=host.substring(1);
            if(endpoint.getHost().equalsIgnoreCase(host)||endpoint.getHost().toLowerCase().endsWith("."+host))return Proxy.NO_PROXY;
        }
        String value=env.getOrDefault("HTTPS_PROXY",env.getOrDefault("https_proxy",""));
        if(value.isBlank())return Proxy.NO_PROXY;
        URI uri=URI.create(value);
        if(!"http".equalsIgnoreCase(uri.getScheme())||uri.getHost()==null||uri.getUserInfo()!=null)
            throw new IllegalArgumentException("Unsupported outbound proxy configuration");
        return new Proxy(Proxy.Type.HTTP,new InetSocketAddress(uri.getHost(),uri.getPort()<0?80:uri.getPort()));
    }
    public HospitalService.Page fetch(String key,String region,String department,int page) {
        HttpURLConnection connection=null;
        try {
            String query="ServiceKey="+URLEncoder.encode(key,StandardCharsets.UTF_8)+"&sidoCd="+region+"&dgsbjtCd="+department+"&pageNo="+page+"&numOfRows=10";
            connection=(HttpURLConnection)URI.create(endpoint+"?"+query).toURL().openConnection(proxy);
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(8000);connection.setReadTimeout(8000);
            connection.setRequestProperty("Accept","application/xml");
            long deadline=System.nanoTime()+8_000_000_000L;
            if(connection.getResponseCode()!=200)throw new ApiException(502,"병원 정보 제공기관에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.");
            try(var input=connection.getInputStream();var output=new ByteArrayOutputStream()) {
                byte[] buffer=new byte[8192];
                while(true) {
                    long remaining=(deadline-System.nanoTime())/1_000_000;
                    if(remaining<=0)throw new java.net.SocketTimeoutException();
                    connection.setReadTimeout((int)Math.min(remaining,8000));
                    int count=input.read(buffer);if(count<0)break;
                    if(output.size()+count>1024*1024)throw new ApiException(502,"병원 정보 응답이 너무 큽니다.");
                    output.write(buffer,0,count);
                }
                return HospitalXml.parse(output.toByteArray());
            }
        }catch(ApiException error){throw error;}catch(Exception error){throw new ApiException(502,"병원 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");}
        finally {if(connection!=null)connection.disconnect();}
    }
}
