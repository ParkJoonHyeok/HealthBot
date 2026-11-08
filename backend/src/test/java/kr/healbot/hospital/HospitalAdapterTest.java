package kr.healbot.hospital;
import com.sun.net.httpserver.HttpServer;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import kr.healbot.web.ApiException;
import static org.assertj.core.api.Assertions.*;
class HospitalAdapterTest {
    static final String XML="<response><header><resultCode>00</resultCode></header><body><totalCount>1</totalCount><items><item><yadmNm>가상 의원</yadmNm><addr>테스트 주소</addr><telno>02-123-4567</telno></item></items></body></response>";
    @Test void parsesSingleItemAndRejectsMalformedOrExternalEntityResponses() {
        assertThat(HospitalXml.parse(XML.getBytes(StandardCharsets.UTF_8)).items().getFirst().phone()).isEqualTo("02-123-4567");
        for(String xml:new String[]{"<broken>","<!DOCTYPE response [<!ENTITY secret SYSTEM 'file:///etc/passwd'>]>"+XML,XML.replace("<resultCode>00","<resultCode>30"),XML.replace("<totalCount>1","<totalCount>-1")})
            assertThatThrownBy(()->HospitalXml.parse(xml.getBytes(StandardCharsets.UTF_8))).isInstanceOf(ApiException.class);
    }
    @Test void missingKeyNeverSilentlyEnablesDemo() {
        var service=new HospitalService(new HospitalHttpClient(),"",false);
        assertThatThrownBy(()->service.search(HospitalService.validate(null,null,null))).isInstanceOfSatisfying(ApiException.class,e->assertThat(e.status()).isEqualTo(503));
    }
    @Test void localHttpServerVerifiesEncodingAndRedirectRefusal() throws Exception {
        var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);var query=new AtomicReference<String>();
        server.createContext("/hospitals",exchange->{query.set(exchange.getRequestURI().getRawQuery());var bytes=XML.getBytes(StandardCharsets.UTF_8);exchange.sendResponseHeaders(200,bytes.length);exchange.getResponseBody().write(bytes);exchange.close();});
        server.createContext("/redirect",exchange->{exchange.getResponseHeaders().set("Location","/hospitals");exchange.sendResponseHeaders(302,-1);exchange.close();});
        server.start();
        try {
            var base="http://127.0.0.1:"+server.getAddress().getPort();
            var client=new HospitalHttpClient(URI.create(base+"/hospitals"),Proxy.NO_PROXY);
            assertThat(client.fetch("test+key=","110000","01",2).total()).isEqualTo(1);
            assertThat(query.get()).contains("ServiceKey=test%2Bkey%3D","sidoCd=110000","dgsbjtCd=01","pageNo=2");
            assertThatThrownBy(()->new HospitalHttpClient(URI.create(base+"/redirect"),Proxy.NO_PROXY).fetch("private-key","110000","01",1))
                .isInstanceOfSatisfying(ApiException.class,e->{assertThat(e.status()).isEqualTo(502);assertThat(e.getMessage()).doesNotContain("private-key");});
        }finally{server.stop(0);}
    }
    @Test void inheritsProxyAndHonorsBypassHosts() {
        var env=Map.of("HTTPS_PROXY","http://127.0.0.1:8080","NO_PROXY","localhost,.example.com");
        assertThat(HospitalHttpClient.proxyFor(URI.create("https://apis.data.go.kr"),env).type()).isEqualTo(Proxy.Type.HTTP);
        assertThat(HospitalHttpClient.proxyFor(URI.create("https://api.example.com"),env)).isEqualTo(Proxy.NO_PROXY);
    }
}
