import csv
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter
from openpyxl.comments import Comment
F='맑은 고딕'
def font(**k): return Font(name=F, size=k.get('size',10), bold=k.get('bold',False), color=k.get('color','000000'))
HDR=PatternFill('solid', fgColor='1F2A2E'); HDRF=Font(name=F,size=10,bold=True,color='FFFFFF')
INP=PatternFill('solid', fgColor='FFF7CC')
thin=Side(style='thin', color='C8C8C8'); BRD=Border(left=thin,right=thin,top=thin,bottom=thin)
wb=Workbook()
def sheet(name, headers, widths=None, first=False):
    ws = wb.active if first else wb.create_sheet(); ws.title=name; ws.append(headers)
    for c in ws[1]: c.fill=HDR; c.font=HDRF; c.alignment=Alignment(vertical='center', wrap_text=True); c.border=BRD
    ws.freeze_panes='A2'; ws.row_dimensions[1].height=30
    if widths:
        for i,w in enumerate(widths,1): ws.column_dimensions[get_column_letter(i)].width=w
    return ws
def fill_rows(ws, rows, start=2):
    for r,row in enumerate(rows, start):
        for c,v in enumerate(row,1):
            cell=ws.cell(row=r, column=c, value=v); cell.font=font(); cell.border=BRD; cell.alignment=Alignment(vertical='top', wrap_text=True)
ws=sheet('읽어보기',['구분','내용'],[18,110],first=True)
fill_rows(ws,[
 ['이 파일','세광/오딘 빅데이터의 기초자료. 각 탭을 "빅데이터" 스프레드시트로 복사해 누적 관리합니다.'],
 ['탭 순서','코드규칙 → 코드마스터 → 목록(드롭다운용) → 품목마스터 → 거래처마스터 → 이카운트칸매핑 → 카테고리안 → 경쟁사비교 → 변경이력'],
 ['입력하는 곳','노란 칸(품목마스터·거래처마스터)만 입력합니다. 품목코드·품목명·글자수·HS코드는 수식이 자동으로 만듭니다.'],
 ['드롭다운','품목마스터의 대분류·소재·색·기능·용도 칸은 목록 탭에서 골라 넣는 드롭다운입니다. 오타(bik 등)가 원천 차단됩니다.'],
 ['코드 표기','전부 대문자, 하이픈(-)만 사용, 없는 부위는 NN. 예: CST001-AT-AT-BK (15자), THP031-WT-BK-BK-1200 (20자), BST002-BK-NN-NN (철재 바텐)'],
 ['장르 대분류','의자 C · 바텐 B · 보조스툴 L · 탁자 T · 상판 P · 다리 G · 소파 S · 아웃도어 O · 집기 F · 부속 A. 바텐과 보조스툴은 소재와 무관한 장르라 대분류(사장님 지시 2026-09-06)'],
 ['출처','사장님 종합계획설계도(카테고리) 약어 + 빅데이터 시트 "코드" 탭 표준안 + 클로드 조사(2026-09-05)'],
 ['확신도 표시','추론·기억에 의존한 항목은 비고에 "확신도 %"를 적었습니다. 이카운트 칸 길이·HS 세부호수는 적용 전 확인 필요.'],
])
ws=sheet('코드규칙',['구분','항목','규칙','예시','이유'],[12,22,48,26,48])
fill_rows(ws,[
 ['구조','품목코드','[대분류1][소재2][일련3]-[1대시 색2]-[2대시 색2]-[3대시 색2]-[규격4, 탁자류만]','CST001-AT-AT-BK','앞 6자=모델, 뒤=변형(색·규격). 사장님 원안 구조 그대로'],
 ['구조','최대 길이','6 + 3×3 + 5 = 20자','THP031-WT-BK-BK-1200','이카운트 품목코드 한도 20자 (확신도 85%, 품목등록 화면에서 확인)'],
 ['구조','대시의 뜻 (의자·바텐·소파·아웃도어)','프레임 / 등판 / 좌판·방석','CST001-AT-AT-BK',''],
 ['구조','대시의 뜻 (보조스툴)','프레임 / NN / 좌판·방석','LST001-BK-NN-BK','등판이 없는 장르'],
 ['구조','대시의 뜻 (탁자)','상판 / 다리 / 엣지','THP031-WT-BK-BK-1200','설계도의 "엣지색상 TB-eg" 반영'],
 ['구조','대시의 뜻 (상판 단품)','상판 / 엣지 / NN','PHP012-WT-BK-NN-1200',''],
 ['구조','대시의 뜻 (다리 단품)','다리 / NN / NN + 높이','GST005-BK-NN-NN-0720',''],
 ['표기','문자','전부 대문자, 영문·숫자·하이픈만','CST001-AT-AT-BK','$ # & @ / 는 CSV·인터넷주소·바코드에서 깨짐. 대소문자 혼용 시 검색·정렬 누락'],
 ['표기','없는 부위','NN (고정 2자)','CST012-BK-NN-BK','숫자 0과 영문 O 혼동 방지. 자릿수 유지'],
 ['표기','일련번호','3자리 고정 (001~999)','CST001','Cs5처럼 자리가 흔들리면 엑셀 수식이 깨짐'],
 ['표기','규격','탁자·상판·다리만 mm 4자리 (0720처럼 앞에 0)','-1200 / -0720','자릿수 고정'],
 ['대분류','장르 1자','C 의자 · B 바텐 · L 보조스툴 · T 탁자 · P 상판 · G 다리 · S 소파 · O 아웃도어 · F 집기·선반 · A 부속','BST002 / LPL001','바텐·스툴은 소재와 무관한 장르 → 대분류. 그 아래 소재 2자. L 글자는 바꿔도 됨'],
 ['소재','2자','ST 철재 · WO 목재 · PL 사출 · AL 알루미늄 · RA 라탄 · SS 스텐 · LP LPM · HP HPL · SW 집성목 · WS 우드슬랩 · CM 세라믹 …','CST / BWO / THP','스텐은 SS (원안 st와 분리). 바텐 철재는 CBT가 아니라 규칙대로 BST'],
 ['색·마감','2자','WT BK GR IV BG BL GN SV GD KK AT NA BR RD VT + NN','','사장님 약어 그대로. 골드의자는 소재가 아니라 색 GD. RAL 대응은 코드마스터 참고'],
 ['원칙','코드 vs 칸','코드에는 모델+변형만. 기능(암체어·수납)·용도(카페·식당)·HS코드는 이카운트 품목그룹·추가항목 칸에','CST-S 같은 확장 금지','세계 표준 ERP 원칙: 코드는 짧게, 속성은 칸에. 속성이 늘어도 코드가 안 무너짐'],
 ['원칙','품목명','시리즈명 + 소재품목 + 색(프레임/등판/좌판) + 규격','나비수인 철재의자 엔틱/엔틱/블랙','사람이 읽고 검색하는 이름. 100자 이내'],
])
rows=list(csv.reader(open('/home/user/ecount-mcp/docs/코드마스터_분류기초자료.csv',encoding='utf-8'))); data=rows[1:]
ws=sheet('코드마스터',['축','코드','코드명','설명','사장님 기존 표기','비고','키(수식용)'],[12,10,18,40,26,26,18])
for r,row in enumerate(data,2):
    row=row+['']*(6-len(row))
    for c,v in enumerate(row,1):
        cell=ws.cell(row=r,column=c,value=v); cell.font=font(); cell.border=BRD; cell.alignment=Alignment(vertical='top',wrap_text=True)
    k=ws.cell(row=r,column=7,value=f'=A{r}&"|"&UPPER(B{r})'); k.font=font(color='808080'); k.border=BRD
ws.auto_filter.ref=f'A1:G{len(data)+1}'
axes={'품목':[],'소재':[],'색상':[],'기능':[],'용도':[]}
for row in data:
    if row[0] in axes: axes[row[0]].append(row[1].upper() if row[0]!='기능' else row[1])
ws=sheet('목록',['대분류','소재','색·마감','기능','용도'],[12,12,12,12,12])
for c,(ax,vals) in enumerate(axes.items(),1):
    for r,v in enumerate(vals,2):
        cell=ws.cell(row=r,column=c,value=v); cell.font=font(); cell.border=BRD
n={k:len(v) for k,v in axes.items()}
def rng(col,cnt): return f"='목록'!${col}$2:${col}${cnt+1}"
H=['대분류','소재','일련번호','1대시\n프레임/상판','2대시\n등판/다리','3대시\n좌판/엣지','규격\n(탁자류 mm)','품목코드\n(자동)','글자수','20자 검사','시리즈명','품목명\n(자동)','규격 W×D×H','품목그룹1\n대분류','품목그룹2\n소재','품목그룹3\n용도태그','기능·형태','HS코드\n(자동)','원산지·협력공장','매입가','판매가','쇼핑몰 카테고리','이카운트 등록','등록일','비고']
W=[8,8,9,10,10,10,10,22,7,9,14,34,16,10,10,12,10,10,16,10,10,18,10,11,20]
ws=sheet('품목마스터',H,W)
ex=[
 ['C','ST',1,'AT','AT','BK','','','','','나비수인','','W450×D520×H860','','','CF','bc','','국산 진접공장',0,0,'의자>철재의자','','2026-09-06','예시 행. 실제 값으로 바꾸세요'],
 ['C','ST',1,'NA','NA','BR','','','','','나비수인','','W450×D520×H860','','','CF','bc','','국산 진접공장',0,0,'의자>철재의자','','2026-09-06','같은 모델 001의 색 변형'],
 ['B','ST',2,'BK','NN','NN','','','','','','','W400×D400×H750','','','CF','hi','','수입 중국 허베이',0,0,'바텐>철재바텐','','2026-09-06','바텐 장르: B + 소재'],
 ['L','PL',1,'WT','NN','WT','','','','','','','W350×D350×H450','','','RS','sl','','수입',0,0,'보조스툴>플라스틱','','2026-09-06','보조스툴 장르: L + 소재'],
 ['T','HP',31,'WT','BK','BK',1200,'','','','','','W1200×D700×H720','','','RS','sq','','국산 진접공장',0,0,'탁자>인조상판>HPL','','2026-09-06','탁자: 상판/다리/엣지 + 규격'],
 ['G','ST',5,'BK','NN','NN',720,'','','','','','H720','','','','p3','','수입 중국 허베이',0,0,'부품>탁자다리','','2026-09-06','다리 단품: 다리/NN/NN + 높이'],
 ['S','WO',8,'NA','BR','BR','','','','','모던','','W1400×D800×H800','','','HT','s2','','베트남',0,0,'소파>목재소파','','2026-09-06',''],
]
LK='코드마스터!$G:$G'; LC='코드마스터!$C:$C'
for R,row in enumerate(ex,2):
    for c,v in enumerate(row,1):
        cell=ws.cell(row=R,column=c,value=v if v!='' else None); cell.font=font(); cell.border=BRD; cell.alignment=Alignment(vertical='top',wrap_text=True)
    for c in (1,2,3,4,5,6,7,11,13,16,17,19,20,21,22,23,24,25): ws.cell(row=R,column=c).fill=INP
    ws.cell(row=R,column=8,value=f'=IF(A{R}="","",UPPER(A{R}&B{R}&TEXT(C{R},"000")&"-"&D{R}&"-"&E{R}&"-"&F{R}&IF(G{R}="","","-"&TEXT(G{R},"0000"))))')
    ws.cell(row=R,column=9,value=f'=IF(H{R}="","",LEN(H{R}))')
    ws.cell(row=R,column=10,value=f'=IF(H{R}="","",IF(I{R}>20,"초과!","OK"))')
    ws.cell(row=R,column=12,value=f'=IF(A{R}="","",TRIM(K{R}&" "&IFERROR(INDEX({LC},MATCH("소재|"&UPPER(B{R}),{LK},0)),"")&IFERROR(INDEX({LC},MATCH("품목|"&UPPER(A{R}),{LK},0)),"")&" "&IFERROR(INDEX({LC},MATCH("색상|"&UPPER(D{R}),{LK},0)),"")&"/"&IFERROR(INDEX({LC},MATCH("색상|"&UPPER(E{R}),{LK},0)),"")&"/"&IFERROR(INDEX({LC},MATCH("색상|"&UPPER(F{R}),{LK},0)),"")&IF(G{R}="",""," "&G{R})))')
    ws.cell(row=R,column=14,value=f'=IF(A{R}="","",A{R}&" "&IFERROR(INDEX({LC},MATCH("품목|"&UPPER(A{R}),{LK},0)),""))')
    ws.cell(row=R,column=15,value=f'=IF(B{R}="","",UPPER(B{R})&" "&IFERROR(INDEX({LC},MATCH("소재|"&UPPER(B{R}),{LK},0)),""))')
    ws.cell(row=R,column=18,value=f'=IF(B{R}="","",IF(OR(A{R}="T",A{R}="P",A{R}="G",A{R}="F"),IF(OR(UPPER(B{R})="WO",UPPER(B{R})="SW",UPPER(B{R})="WS",UPPER(B{R})="AH",UPPER(B{R})="VN",UPPER(B{R})="NB"),"9403.60",IF(UPPER(B{R})="RA","9403.83",IF(UPPER(B{R})="PL","9403.70","9403.20"))),IF(OR(UPPER(B{R})="ST",UPPER(B{R})="AL",UPPER(B{R})="SS"),"9401.71",IF(UPPER(B{R})="WO","9401.61",IF(UPPER(B{R})="PL","9401.80",IF(UPPER(B{R})="RA","9403.83",""))))))')
    for c in (8,9,10,12,14,15,18):
        cell=ws.cell(row=R,column=c); cell.font=font(color='1F4E79'); cell.border=BRD
for dv,rg in ((DataValidation(type='list', formula1=rng('A',n['품목']), allow_blank=True),'A2:A500'),(DataValidation(type='list', formula1=rng('B',n['소재']), allow_blank=True),'B2:B500'),(DataValidation(type='list', formula1=rng('C',n['색상']), allow_blank=True),'D2:F500'),(DataValidation(type='list', formula1=rng('D',n['기능']), allow_blank=True),'Q2:Q500'),(DataValidation(type='list', formula1=rng('E',n['용도']), allow_blank=True),'P2:P500')):
    dv.add(rg); ws.add_data_validation(dv)
ws['A1'].comment=Comment('노란 칸만 입력. 파란 글씨는 자동 수식. 드롭다운으로 고르면 오타가 안 납니다.','Claude')
ws.cell(row=len(ex)+3,column=1,value='※ 위 행은 예시입니다. 실제 품목으로 바꾸거나 지우고 쓰세요. 새 행은 예시 행의 파란 수식 칸을 아래로 끌어 복사하면 됩니다.').font=font(color='808080')
H=['거래처코드','거래처명','회사\n(오딘/세광)','사업자번호','대표자','담당자','핸드폰','전화','주소','업종태그\n(CF/RS/CT/OF/HT/OD/HM)','매출등급\n(S~D)','거래구분','주거래 품목','이카운트 등록','최근거래일','비고']
ws=sheet('거래처마스터',H,[12,20,10,14,10,10,13,13,36,14,9,12,18,10,11,24])
fill_rows(ws,[['(이카운트 코드)','예시 거래처','오딘','','','','010-0000-0000','','서울…','RS','B','매출','철재의자·HPL탁자','Y','2026-09-01','예시 행. 기존 "통합거래처마스터 A.xlsx의 사본"(862곳)을 이 열 순서로 붙여 넣으세요']])
for c in range(1,17): ws.cell(row=2,column=c).fill=INP
for dv,rg in ((DataValidation(type='list', formula1='"S,A,B,C,D"', allow_blank=True),'K2:K2000'),(DataValidation(type='list', formula1='"오딘,세광,공통"', allow_blank=True),'C2:C2000'),(DataValidation(type='list', formula1='"매출,매입,협력공장,매출+매입"', allow_blank=True),'L2:L2000')):
    dv.add(rg); ws.add_data_validation(dv)
ws=sheet('이카운트칸매핑',['이카운트 칸','넣는 값','예 (CST001-AT-AT-BK)','품목마스터 열','비고'],[16,34,30,14,40])
fill_rows(ws,[
 ['품목코드','규칙대로 만든 코드','CST001-AT-AT-BK','H','20자 이내 (확신도 85%)'],
 ['품목명','시리즈+소재품목+색+규격','나비수인 철재의자 엔틱/엔틱/블랙','L','100자 이내'],
 ['규격','W×D×H mm','W450×D520×H860','M',''],
 ['품목그룹1','대분류(장르)','C 의자','N','소재별·품목별 보고서에 사용'],
 ['품목그룹2','소재','ST 철재','O',''],
 ['품목그룹3','용도 태그 또는 시리즈','CF 카페','P','다중이면 대표 1개'],
 ['추가항목1','프레임/상판 색','AT','D',''],
 ['추가항목2','등판/다리 색','AT','E',''],
 ['추가항목3','좌판/엣지 색','BK','F',''],
 ['추가항목4','HS코드','9401.71','R','수입품 통관 (세부호수 확신도 85%)'],
 ['추가항목5','원산지·협력공장','CN-허베이','S',''],
 ['바코드','GS1 GTIN 또는 품목코드(Code128)','','','네이버·쿠팡 상품 매칭에 유리'],
 ['입고단가/출고단가','매입가/판매가','','T/U',''],
])
ws=sheet('카테고리안',['축','대분류(코드)','중분류','소분류·필터','현재 사이트 등록 수(확인)','비고'],[12,16,50,40,30,30])
fill_rows(ws,[
 ['1축 품목→소재','의자 C','목재 WO · 철재 ST · 사출 PL · 알루미늄 AL · 라탄 RA · 스텐 SS','등받이·암체어·벤치·수납·접이 / 좌판 원목·방석·가죽·패브릭','목재 40 · 철재 143 · 플라스틱 26 · 골드 · 라탄','골드의자는 색(GD) 필터로'],
 ['1축 품목→소재','바텐 B','철재 ST · 목재 WO · 알루미늄 AL · 플라스틱 PL · 라탄 RA','좌고 65/75 · 높이조절','빠체어(의자 아래)','독립 장르로 분리 (사장님 지시)'],
 ['1축 품목→소재','보조스툴 L','철재 · 목재 · 플라스틱 · 알루미늄 · 라탄','수납 · 접이 · 높이조절','보조스툴(의자 아래)','독립 장르로 분리 (사장님 지시)'],
 ['1축 품목→소재','탁자 T','나무계열(SW·WS·AH·VN·NB) / 인조상판(LP·HP) / 기타(CM·SS·PL·ST·DR)','사각·원형·타원 / 2·4·6인 / 브랜드(한림·대신·유신·엘라톤) 필터','우드 65 · 우드그레인 70 · 유신HPL · 집성목 20 · 우드슬랩 7 · 세라믹 4','우드/우드그레인/집성목/우드슬랩 층위 통일'],
 ['1축 품목→소재','소파 S','목재 WO · 철재 ST · 패브릭 FB · 가죽 LE','1인·2인·3인·붙박이·오토만·코너','목재 7 · 철재 22 · 붙박이 7 · 가정용 9',''],
 ['1축 품목→소재','아웃도어 O','합성수지목 WP · 라탄 RA · 알루미늄 AL · 철재 ST','의자·벤치·탁자·파라솔·세트','세부 미확인',''],
 ['1축 품목→소재','집기·선반 F','선반·카운터·파티션','','집기(의자3·소파3·탁자9·다리20·선반4·액세서리2)','중복 정리 대상'],
 ['2축 업종 태그','CF 카페','카페테이블 600~750, 목재·철재 의자, 바텐, 소파·라운지','상품에 태그 여러 개 → 카페24 다중 카테고리','',''],
 ['2축 업종 태그','RS 식당·주점','4인 HPL·세라믹 탁자, 사출·철재 의자, 붙박이소파, 드럼통','','',''],
 ['2축 업종 태그','CT 구내식당','6인 이상 탁자, 사출 의자, 벤치','','',''],
 ['2축 업종 태그','OF 사무·중역','사무용 의자, 회의 테이블, 파티션','','',''],
 ['2축 업종 태그','HT 호텔·숙박','라운지, 1인 소파, 사이드 테이블','','',''],
 ['2축 업종 태그','OD 야외','아웃도어 전체, 파라솔','','',''],
 ['2축 업종 태그','HM 가정·홈카페','가정용 소파, 식탁 세트','','',''],
 ['2축 업종 태그','납품사례','프랜차이즈 본사별 실적 + 시공사진 + 품목코드 링크','','','금성파지오·이피카소 방식'],
 ['3축 부품·서비스','상판 P','LP·HP·SW·CM·WS·NB 규격별 재고현황','이카운트 연동','상판 재고현황 1',''],
 ['3축 부품·서비스','탁자다리 G','원반·2/3/4인치·쌍기둥·프레임·H형·평판곡·조절·수입','색 BK·WT·SV·GD','탁자다리 64~80',''],
 ['3축 부품·서비스','컬러칩·샘플','상판 색상표(한림·대신·유신·엘라톤·포마이카·롱코·일중), 프레임 분체 색','','','한국TA 방식'],
 ['3축 부품·서비스','세트 상품','의자+탁자 2인/4인, 야외 세트','','','에프엠·이피카소 방식'],
 ['3축 부품·서비스','주문제작','붙박이소파·맞춤 탁자·집기','','','한국TA 방식'],
 ['3축 부품·서비스','베스트·신상품·재고특가','자동 정렬','','',''],
])
ws=sheet('경쟁사비교',['회사','사이트','대분류 구성','분류 기준','특징','확인 방법'],[14,24,60,20,32,22])
fill_rows(ws,[
 ['세광/오딘 (우리)','gagucafe114.com','의자 / 탁자 / 소파 / 아웃도어 / 집기 / 선반','품목→소재','부품(다리·상판) 강함, 소재 층위 혼재','검색 색인 카테고리 페이지'],
 ['금성파지오','pazio.co.kr','의자(92) / 소파 / 테이블(46) / 테이블다리 / 테라스·발코니 / 납품실적 / 시공갤러리','품목→소재','납품실적·시공사례를 카테고리로','검색 색인'],
 ['에프엠가구','fmgagu.com','CHAIR(588) / ARMCHAIR / BARSTOOL·BENCH / LOUNGE·SOFA / TABLE(상판·다리) / ACC / OUTDOOR / SET / 브랜드(TON·FMMADE)','품목→소재+브랜드+세트','영문 대분류, 세트, 수입 브랜드 축','검색 색인'],
 ['이피카소','e-picasso.com','의자(8종) / 바텐(5) / 테이블(9) / 야외(7) / 소파(5) / 인기야외 BEST','품목→소재·용도','하위 분류 가장 촘촘, 대량납품','검색 색인'],
 ['금풍무역','gppo5789.co.kr','테이블상판 / 합성수지목·라탄 테이블(29) / 알루미늄 의자 / 대리석+주물다리 / 세트','소재→품목','저가 수입 야외·라탄','검색 색인'],
 ['하이퍼스','hifus.com','중역용 / 사무용 / 식당용 / 숙박 / 야외용','용도(업종)','업종별 큐레이션형','검색 색인'],
 ['한국TA','ikta.co.kr','의자 / 소파 / 테이블·상판·다리 / 주문제작(집기·오피스·소파) / 제작샘플칩','품목→소재','컬러칩, 주문제작 별도','검색 색인'],
 ['영가구','younggagu.com','의자(8종) / 바텐 / 테이블 / 소파·라운지 / 야외 / 실내벤치 / 베스트','품목→소재','가정+카페 겸용','검색 색인'],
 ['체어팩토리','chairfactory.co.kr','의자(목재·라탄·철재) / 가죽바텐 / 소파·라운지 / 소파테이블 / 목재테이블 / 야외세트 / 사무용의자','품목→소재','디자인 의자 중심','검색 색인'],
 ['한샘몰','store.hanssem.com','공간별 10개 + 상품별(침실·수납·서재·거실·키즈·주방·소가구·매장가구…)','공간+품목 2축','공간 탭과 품목 탭 동시','검색 색인'],
 ['이케아','ikea.com/kr','제품별 + 공간별 + 컬렉션 + 베스트 + 신제품','품목+공간+컬렉션 3축','다축 구조 세계 표준','검색 색인'],
 ['쿠팡','coupang.com','침실·거실·수납·유아동·주방·학생사무·드레스룸·야외·가구부자재 / 식탁테이블 / 의자소파','공간(가정)→품목','업소용 전용 카테고리 없음','검색 색인'],
 ['네이버쇼핑','shopping.naver.com','가구/인테리어 > 거실·침실·주방·수납·아동·서재사무 …','공간(가정)→품목','상세 미확인, 업소용 흩어짐 (추론 70%)','미확인'],
])
ws=sheet('변경이력',['날짜','탭','내용','작성','비고'],[12,14,70,10,30])
fill_rows(ws,[
 ['2026-09-05','전체','경쟁사 12곳 카테고리 조사, 3축 카테고리안, 코드 체계 초안','클로드',''],
 ['2026-09-06','코드규칙','사장님 원안(Cst001-at-at-bk) 기준 20자 고정폭으로 개정. 대문자·NN 통일','클로드','빅데이터 시트 코드 탭 표준안과 합침'],
 ['2026-09-06','코드규칙','바텐(B)·보조스툴(L)을 소재 무관 장르 대분류로 추가','클로드','사장님 지시'],
 ['2026-09-06','품목마스터','드롭다운·자동 코드·자동 품목명·HS코드 수식 추가','클로드',''],
])
wb.save('빅데이터_추가시트.xlsx'); print('saved', [w.title for w in wb.worksheets])
