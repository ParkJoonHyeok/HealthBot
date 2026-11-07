const $ = id => document.getElementById(id);
for (const chip of document.querySelectorAll('[data-symptom]')) chip.addEventListener('click', () => { $('input').value = chip.dataset.symptom; $('input').focus(); });
function paragraph(parent,text) { const p = document.createElement('p'); p.textContent = text; parent.append(p); }
$('symptom-form').addEventListener('submit', async event => {
  event.preventDefault(); const result = $('result'); result.replaceChildren(); $('submit').disabled = true; $('submit').textContent = '확인 중…';
  try {
    const response = await fetch('/api/guide',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({symptoms:$('input').value}),signal:AbortSignal.timeout(10000)});
    const data = await response.json(); if (!response.ok) throw new Error(data.error);
    paragraph(result,data.notice);
    if (data.emergency) { const a = document.createElement('a'); a.href='tel:119'; a.textContent='119에 전화하기'; result.append(a); }
    else if (!data.matches.length) paragraph(result,'일치하는 안내가 없습니다. 증상이 지속되거나 걱정된다면 가정의학과 등 의료진과 상담하세요.');
    for (const match of data.matches) { const section = document.createElement('div'); section.className='match'; paragraph(section,match.department+' · '+match.topics.join(', ')); const button=document.createElement('button'); button.textContent=match.department+' 병원 찾기'; button.addEventListener('click',()=> { $('department').value=match.department; $('region').focus(); }); section.append(button); result.append(section); }
    paragraph(result,data.disclaimer);
  } catch(error) { paragraph(result,error.name === 'TimeoutError' ? '응답이 늦어지고 있습니다. 잠시 후 다시 시도해 주세요.' : error.message); }
  finally { $('submit').disabled=false; $('submit').textContent='관련 진료과 확인하기 →'; }
});
$('hospital-form').addEventListener('submit',event=> { event.preventDefault(); const region=$('region').value.trim(); if (!region) { $('region').setCustomValidity('지역을 입력해 주세요.'); $('region').reportValidity(); return; } const a=document.createElement('a'); a.href='https://map.naver.com/p/search/'+encodeURIComponent(region+' '+$('department').value); a.target='_blank'; a.rel='noopener noreferrer'; a.textContent='네이버 지도에서 '+region+' '+$('department').value+' 검색 ↗'; $('map-result').replaceChildren(a); });
$('region').addEventListener('input',()=> $('region').setCustomValidity(''));
