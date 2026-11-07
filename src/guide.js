const rules = [
  { words: ['기침','콧물','인후통','목 아','발열'], department: '내과', topics: ['감기 등 호흡기 질환', '알레르기 관련 증상'] },
  { words: ['복통','배가','설사','구토','속쓰림'], department: '내과', topics: ['위장관 관련 질환'] },
  { words: ['피부','가려','발진','두드러기'], department: '피부과', topics: ['피부염 및 알레르기 관련 질환'] },
  { words: ['허리','무릎','관절','발목'], department: '정형외과', topics: ['근골격계 관련 질환'] },
  { words: ['두통','어지러'], department: '신경과', topics: ['두통 및 어지럼 관련 질환'] },
  { words: ['귀','코막힘'], department: '이비인후과', topics: ['귀·코 관련 질환'] }
];
export function guide(symptoms) {
  if (typeof symptoms !== 'string' || symptoms.trim().length < 2 || symptoms.length > 1000) {
    const error = new Error('증상을 2~1,000자로 입력해 주세요.'); error.status = 400; throw error;
  }
  const emergency = /가슴.*통증|흉통|숨.*(못|어려|차)|호흡곤란|의식|마비|말.*어눌|극심한.*두통|심한.*출혈/.test(symptoms);
  return {
    mode: 'rules', emergency,
    notice: emergency ? '응급 징후와 관련된 표현이 감지되었습니다. 증상이 현재 발생 중이라면 즉시 119에 연락하거나 응급실을 방문하세요.' : '응급 징후가 없다는 뜻은 아닙니다. 갑작스럽거나 심한 증상은 즉시 의료진에게 문의하세요.',
    matches: emergency ? [] : rules.filter(rule => rule.words.some(word => symptoms.includes(word))).map(({department,topics}) => ({department,topics})),
    disclaimer: '키워드 기반 참고 정보이며 AI 분석이나 의학적 진단이 아닙니다. 실제 질환과 진료과는 의료진의 평가가 필요합니다.'
  };
}
