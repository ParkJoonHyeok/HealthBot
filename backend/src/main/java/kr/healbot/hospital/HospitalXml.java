package kr.healbot.hospital;

import java.io.ByteArrayInputStream;
import java.util.ArrayList;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import org.w3c.dom.Element;
import org.xml.sax.SAXException;
import org.xml.sax.SAXParseException;
import org.xml.sax.helpers.DefaultHandler;
import kr.healbot.web.ApiException;

public final class HospitalXml {
    private HospitalXml() {}
    private static ApiException invalid() {return new ApiException(502,"병원 정보 응답 형식이 올바르지 않습니다.");}
    private static Element child(Element element,String name) {
        if(element==null)return null;
        for(var node=element.getFirstChild();node!=null;node=node.getNextSibling())
            if(node instanceof Element e && e.getTagName().equals(name))return e;
        return null;
    }
    private static String text(Element element,String name) {var c=child(element,name);return c==null?"":c.getTextContent();}
    public static HospitalService.Page parse(byte[] bytes) {
        if(bytes.length>1024*1024)throw invalid();
        try {
            var factory=DocumentBuilderFactory.newInstance();
            factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING,true);
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl",true);
            factory.setFeature("http://xml.org/sax/features/external-general-entities",false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities",false);
            factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD,"");
            factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA,"");
            factory.setXIncludeAware(false);factory.setExpandEntityReferences(false);
            var builder=factory.newDocumentBuilder();
            builder.setErrorHandler(new DefaultHandler(){
                @Override public void error(SAXParseException e) throws SAXException {throw e;}
                @Override public void fatalError(SAXParseException e) throws SAXException {throw e;}
            });
            var root=builder.parse(new ByteArrayInputStream(bytes)).getDocumentElement();
            if(!root.getTagName().equals("response") || !text(child(root,"header"),"resultCode").equals("00"))
                throw new ApiException(502,"병원 정보 제공기관에서 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.");
            var body=child(root,"body");String count=text(body,"totalCount");
            if(!count.matches("[0-9]+"))throw invalid();
            long total=Long.parseLong(count);if(total>9007199254740991L)throw invalid();
            var items=child(body,"items");if(total>0 && items==null)throw invalid();
            var hospitals=new ArrayList<HospitalService.Hospital>();
            if(items!=null)for(var node=items.getFirstChild();node!=null;node=node.getNextSibling()) {
                if(!(node instanceof Element item) || !item.getTagName().equals("item"))continue;
                String name=text(item,"yadmNm"),address=text(item,"addr");
                if(name.isBlank() || address.isBlank())throw invalid();
                hospitals.add(new HospitalService.Hospital(name,address,text(item,"telno"),text(item,"clCdNm")));
            }
            return new HospitalService.Page(total,hospitals);
        } catch(ApiException e) {throw e;} catch(Exception e) {throw invalid();}
    }
}
