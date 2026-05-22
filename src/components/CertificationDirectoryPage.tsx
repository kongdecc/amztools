'use client'

import React, { useMemo, useState } from 'react'
import { ExternalLink, FileText, Search, ShieldCheck, ShieldX, Globe } from 'lucide-react'

type Region = '全部' | '美国' | '欧盟' | '日本' | '澳洲' | '全球'
type CertType = 'all' | 'mandatory' | 'voluntary'

type Certification = {
  id: number
  name: string
  region: Exclude<Region, '全部'>
  type: Exclude<CertType, 'all'>
  short: string
  desc: string
  products: string[]
  warning: string
  url: string
}

const DATA: Certification[] = [
  {
    id: 1,
    name: 'FCC认证',
    region: '美国',
    type: 'mandatory',
    short: '美国联邦通信委员会强制认证，电子产品进入美国市场必须取得，涉及美国50多个州及所属地区。',
    desc: 'FCC（Federal Communications Commission）认证是电子产品进入美国市场的强制性认证。\n\n证书形式分三种：\n• FCC ID：需送TCB机构发证，报告列名在FCC官网\n• FCC DOC：仅A2LA/NVLAP授权实验室签发，主要用于IT产品，认证周期1-2周\n• FCC VOC：FCC认可实验室签发，适用AV类产品，认证周期约一周\n\n2017年11月起，DoC & VoC 正式变更为 SDoC，经过一年过渡期后已完全替代原有认证方式。通过SDoC认证的产品可自主选择是否标记FCC logo，但需在随附文件中加入符合声明（含美国当地供应商名称、地址或联系网址）。',
    products: ['通信设备', '路由器', '蓝牙产品', '无线键盘鼠标', '手机', 'LED灯具', '充电器', '电动工具', '家用电器', '对讲机'],
    warning: '案例：USFBS201612230004A 对讲机无FCC认证，申请退回，3月14日直到5月12日才批下来。',
    url: 'https://apps.fcc.gov/oetcf/eas/reports/GenericSearch.cfm',
  },
  {
    id: 2,
    name: 'FDA认证',
    region: '美国',
    type: 'mandatory',
    short: '美国食品和药物管理局认证，确保食品、药品、医疗器械、放射产品等安全性，激光类和医疗器械为强制认证。',
    desc: 'FDA（Food and Drug Administration）负责监管食品、药品（含兽药）、医疗器械、食品添加剂、化妆品、带激光类产品等。\n\n医疗器械按风险分为三类：\n• I类：激光测距仪、条码扫描枪（风险较低）\n• II类：血氧仪、胎心仪、心电仪（供应商注册FDA会有510K号）\n• III类：高风险医疗设备，监督最多\n\n激光类和医疗器械类产品为强制性认证，进口商必须在FDA协会备案方可发货。食品接触类产品（如水果刀套装）为非强制性，只需申报即可清关。\n\n眼镜类需 Drop Ball Test（落球测试），太阳镜需 Drop Ball Test + FDA。',
    products: ['医疗器械', '血氧仪', '激光产品', '食品接触产品', '眼镜', '太阳镜', '化妆品', '胎心仪'],
    warning: '案例：NY201612220007A，美国FDA查货-血氧仪，退回深圳仓。',
    url: 'http://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfRL/rl.cfm',
  },
  {
    id: 3,
    name: 'CPSC/CPSIA',
    region: '美国',
    type: 'mandatory',
    short: '美国消费品安全委员会认证，2008年安全改进法案，对儿童产品铅含量及邻苯二甲酸盐有严格规定。',
    desc: 'CPSC（Consumer Product Safety Committee）是美国消费品安全委员会，CPSIA是2008年8月14日签署生效的安全改进法案，是自1972年CPSC成立以来最严厉的消费者保护法案。\n\n要求每件进入美国的儿童用品须获得CPSC资质认可的第三方检测机构安全认证。\n\nCPSC须对供5岁以下儿童使用的12类耐用护理品发出强制性标准：(1)全尺寸婴儿床及非全尺寸婴儿床 (2)学步床 (3)高脚椅、升压椅及钩接式座椅 (4)沐浴椅 (5)围护儿童用的门闸及其他围栏 (6)游戏场 (7)固定活动区 (8)幼儿背带 (9)婴儿手推车 (10)学步车 (11)秋千 (12)推车和摇篮',
    products: ['玩具', '儿童用品', '婴儿奶嘴', '儿童护理产品', '婴儿床', '学步车', '秋千', '幼儿背带'],
    warning: '新法案对儿童产品中铅含量要求更严格，并对玩具和儿童护理用品中邻苯二甲酸盐含量作出新规定。',
    url: '',
  },
  {
    id: 4,
    name: 'ASTM认证',
    region: '美国',
    type: 'mandatory',
    short: '美国材料与试验协会标准，ASTM F963为玩具强制性要求，主要针对儿童安全座椅、婴儿用品、玩具等。',
    desc: 'ASTM（American Society of Testing Materials）前身是国际材料试验协会（IATM），主要制定材料、产品、系统和服务的特性和性能标准。\n\n主要检测项目：儿童安全座椅、婴儿用品、纺织材料、洋娃娃衣物、塑料玩具等。\n\n美国玩具类要求 ASTM F963，该标准根据美国联邦法规的强制性要求制定，内容充分包含了CPSC 16CFR的有关技术要求。',
    products: ['儿童安全座椅', '婴儿用品', '玩具', '纺织材料', '塑料玩具', '洋娃娃'],
    warning: '',
    url: '',
  },
  {
    id: 5,
    name: 'DOT认证',
    region: '美国',
    type: 'mandatory',
    short: '美国交通部认证，对进入美国的各种交通工具和运输危险物品做出规定，没有DOT标志不得上市销售。',
    desc: 'DOT（US Department of Transportation）美国交通部，负责发展和完善与交通运输相关的法规。\n\n有关法规要求加贴DOT标志的工业产品，没有DOT标志不得上市销售；已加贴DOT标志进入市场的产品，发现不符合安全要求的，要责令从市场召回；持续违反DOT标志规定的，将被处以高额罚金被迫退出市场。\n\n涉及FMVSS系列标准（联邦机动车安全标准），覆盖制动系统、轮胎、灯具、安全带、儿童约束系统、摩托车头盔、玻璃材料、燃料系统等众多汽车安全标准。',
    products: ['汽车零部件', '轮胎', '制动系统', '安全带', '儿童约束系统', '摩托车头盔', '车灯', '汽车玻璃'],
    warning: '',
    url: 'https://www.nhtsa.gov/',
  },
  {
    id: 6,
    name: 'UL/ETL认证',
    region: '美国',
    type: 'voluntary',
    short: '美国保险商试验所认证，主要从事电气、电子、机械产品、灯具等公共安全检验，每三个月审核一次。',
    desc: 'UL（Underwriter Laboratories Inc.）主要从事电气、电子设备、机械产品、灯具、建材、防火器材及化学品等公共安全方面的检验工作。ETL与UL均考量产品安规。\n\nUL服务种类：\n• 列名（LISTED）：适用于完整产品，如家用电器、医疗设备、计算机、配电系统等\n• 认可（Recognized）：产品只能作为元器件、原材料在UL列名产品上使用\n• 分级（Classification）：仅对产品特定危害进行评价，一般为工业或商业产品\n\nETL/UL证书能在官网查询到即有效，每三个月审核一次，一年四次。',
    products: ['视听设备', '家用电器', '工业控制设备', '信息技术设备', '灯具', '医疗器械', '电线电缆', '汽车'],
    warning: '',
    url: 'http://database.ul.com/cgi-bin/XYV/template/LISEXT/1FRAME/index.html',
  },
  {
    id: 7,
    name: 'SD认证授权',
    region: '美国',
    type: 'mandatory',
    short: 'SD协会强制认证，带SD功能产品必须取得，SD协会制定SD规格并推广应用，不从事产品生产销售。',
    desc: 'SD协会是由全球国际性公司组成的产业体系，以制定引领产业发展的记忆卡技术，可简化使用者对消费性电子产品（如手机）的使用方式并延伸其产品寿命。是带SD功能产品的强制性认证。\n\nSD协会不从事任何产品的生产、行销与贩售，仅制定SD规格并推广此规格的应用，促进SD记忆卡与设备制造商依照此规格制造兼容的记忆卡与设备。',
    products: ['投影仪', '手机', '平板电脑', '数码相机', '读卡器', '带SD卡槽设备'],
    warning: '案例：USPX-HQLR151207042S 投影仪产品没有SD认证授权导致货物被没收。',
    url: 'https://www.sdcard.org/',
  },
  {
    id: 8,
    name: 'CE认证',
    region: '欧盟',
    type: 'mandatory',
    short: '欧盟强制性安全认证，凡贴有CE标志的产品可在欧盟各成员国内自由销售，是进入欧洲市场的通行证。',
    desc: 'CE标志是所有产品进入欧盟的强制性认证。凡是贴有CE标志的产品就可在欧盟各成员国内销售，无须符合每个成员国的单独要求，从而实现了商品在欧盟成员国范围内的自由流通。\n\n欧盟已发布的新方法指令中对CE标志做出规定的21个指令涉及：低压设备、简单压力容器、玩具安全、建筑产品、电磁兼容、机械、个人保护设备、医疗设备、燃气设备、电梯、冷冻设备、压力设备、无线电和电信终端设备等。\n\n没有CE标志的，不得上市销售；发现不符合安全要求的，要责令从市场收回；持续违反规定的，将被限制或禁止进入欧盟市场。',
    products: ['电气设备', '玩具', '机械', '医疗设备', '建筑产品', '个人防护设备', '无线电设备', '灯具', '电梯'],
    warning: '案例：UKPX201607260002S，FH161028000090 吸顶灯缺少CE认证被海关扣住。',
    url: 'http://www.etr-lab.com/SearchResult.asp',
  },
  {
    id: 9,
    name: 'LFGB认证',
    region: '欧盟',
    type: 'mandatory',
    short: '德国食品卫生管理法认证，刀叉标志表示产品符合德国及欧洲标准，不含对人体有害的有毒物质。',
    desc: 'LFGB认证又称《食品、烟草制品化妆品和其它日用品管理法》，是德国食品卫生管理方面最重要的基本法律文件，执行欧盟指令No.178/2002（食品安全要求）。\n\n刀叉标志是食品安全标志，表示产品已通过检测符合众多德国和欧洲标准，证明不含对人体产生危害的有毒物质，可在德国及其它欧美市场销售。\n\n涉及产品：烤面包炉、三明治炉、电水壶等与食品接触的电器；食品储藏用品；强化玻璃菜板、不锈钢锅等厨具；碗、刀叉、勺、杯盘类餐具；服装、被褥、毛巾、假发、假睫毛、帽子、尿布及其它卫生用品；睡袋、鞋子、手套、表带、手提包等。',
    products: ['厨具', '餐具', '食品接触电器', '服装', '被褥', '毛巾', '化妆品', '烟草产品', '鞋子'],
    warning: '',
    url: '',
  },
  {
    id: 10,
    name: 'ROHS认证',
    region: '欧盟',
    type: 'mandatory',
    short: '欧盟限制有害物质指令，2006年7月正式实施，限制铅、汞、镉等6种有害物质，铅含量不能超过0.1%。',
    desc: 'RoHS（Restriction of Hazardous Substances）是欧盟立法制定的强制性标准，2006年7月1日正式实施。主要用于规范电子电气产品的材料及工艺标准，使之更有利于人体健康及环境保护。\n\n目的在于消除电器电子产品中的铅、汞、镉、六价铬、多溴联苯和多溴二苯醚共6项物质，规定铅的含量不能超过0.1%。\n\n涵盖范围（AC1000V、DC1500V以下）：大型家用电器、小型家用电器、IT及通讯仪器、照明器具、电动工具、玩具/娱乐体育器械、医疗器械、监视/控制装置、自动售货机。',
    products: ['家用电器', 'IT设备', '通讯仪器', '照明器具', '电动工具', '玩具', '医疗器械', '监控装置'],
    warning: '',
    url: 'http://www.etr-lab.com/SearchResult.asp',
  },
  {
    id: 11,
    name: 'E-MARK认证',
    region: '欧盟',
    type: 'mandatory',
    short: '欧洲汽机车及安全零配件认证，依照欧盟法令与欧洲经济委员会法规，确保行车安全及环境保护。',
    desc: 'E-Mark 是欧洲共同市场对汽机车及其安全零配件产品、噪音及废气等的认证，需依照欧盟法令【EEC Directives】与欧洲经济委员会法规【ECE Regulation】的规定，通过产品符合认证要求，即授予合格证书。\n\n自2002年10月起，规定所有车辆、车辆零部件以及用于车上的电子性产品必须强制执行EMC测试。所有在欧销售的电子零部件须统一符合EMC指令95/54/EC。\n\n原先申请的CE(EMC)认证从2002年10月起不再有效，必须重新申请欧洲国家交通部门出具的E/eMark证书。',
    products: ['整车', '车灯与灯泡', '各种视镜', '轮胎', '刹车', '喇叭', '安全带', '汽车玻璃', '安全帽', '儿童安全椅'],
    warning: '',
    url: '',
  },
  {
    id: 12,
    name: 'PSE认证',
    region: '日本',
    type: 'mandatory',
    short: '日本电气产品安全法认证，A类贴菱形PSE标志，B类贴圆形PSE标志，是进入日本市场的必要条件。',
    desc: 'PSE认证（Product Safety of Electrical Appliance & Materials）是日本政府针对电子电气产品实行的市场准入制度，是日本《电气产品安全法》（DENAN）的重要内容。2001年4月1日修订实施，由METI（日本经济产业省）管理。\n\nA类（特定电气用品）→ 菱形PSE标志：必须有受日本经贸工业部许可的第三方认证机构认证。\n\nB类（非特定电气用品）→ 圆形PSE标志：须经日本经济产业省认可之实验室测试，确认符合日本电气用品技术基准，取得合格测试报告PSE证书。',
    products: ['电线电缆', '变压器', '家用电器', '电热器具', '充电器', '电动工具', '照明设备', '熔断器'],
    warning: '',
    url: 'http://www.meti.go.jp/english/policy/economy/consumer/pse/index.html',
  },
  {
    id: 13,
    name: 'TELEC认证',
    region: '日本',
    type: 'mandatory',
    short: '日本无线电设备型号核准认证，遵循日本电波法，是无线电设备进入日本市场的强制性认证。',
    desc: '日本《无线电法》要求，对指定的无线电设备进行型号核准（即技术法规符合性认证）。TELEC（Telecom Engineering Center）是日本无线电设备符合性认证的主要注册认证机构，在日本也叫MIC认证。\n\n遵循日本电波法，具体测试规范遵循MIC（日本总务省）Notice No.88法规。\n\nTELEC认证包括测试认证和型式认证。',
    products: ['无线通信设备', '蓝牙设备', 'WiFi设备', '无线键盘鼠标', '对讲机', '无线麦克风'],
    warning: '',
    url: 'http://www.tele.soumu.go.jp/j/material/test.htm',
  },
  {
    id: 14,
    name: '厚生劳动许可证',
    region: '日本',
    type: 'mandatory',
    short: '日本厚生劳动省认证，与食品接触的产品必须取得，必须在日本当地办理，每次出货均需向卫生检疫所申报。',
    desc: '与食品接触的产品需要做厚生劳动许可证，且一定要在日本当地做。产品做好后，后续产品出货每次需向日本卫生检疫所申报且需收费用。\n\n产品类别：厨房用品、水果刀、锅碗瓢盆、勺子、烧烤夹，跟人体接触的食品、药品（包括兽药）、医疗器械、食品添加剂等。\n\n注意：涉及到婴儿用品、玩具类的，如果外包装没有表示此玩具适合7岁以上儿童都是不能发的。',
    products: ['厨房用品', '水果刀', '锅碗瓢盆', '烧烤夹', '食品添加剂', '医疗器械', '药品'],
    warning: '案例：第三方平台雪糕机，做检测加许可证花费4万RMB，每发一次货物还需支付12000日元。',
    url: 'http://www.mhlw.go.jp/',
  },
  {
    id: 15,
    name: 'ST认证',
    region: '日本',
    type: 'voluntary',
    short: '日本安全玩具标识，1971年建立，确保14岁及以下儿童玩具安全，包含物理机械、阻燃、化学性能三部分。',
    desc: '1971年，日本玩具协会（JTA）建立了日本安全玩具标识（ST Mark），用以确保14岁及以下儿童玩具的安全，主要包括三部分：物理机械性能、阻燃性能和化学性能。\n\n涵盖范围：驱动玩具、科学玩具、儿童特定手工玩具、花园用玩具、玩具运动设施、水上玩具、圣诞用品、连接电视的视频玩具/游戏机、组合玩具、饰物玩具等。',
    products: ['玩具', '儿童自行车', '水上玩具', '沐浴玩具', '圣诞用品', '饰物玩具', '视频游戏机'],
    warning: '',
    url: '',
  },
  {
    id: 16,
    name: 'C-Tick认证',
    region: '澳洲',
    type: 'voluntary',
    short: '澳大利亚通讯局EMC认证标志，主要涉及工业科技医用设备、音像设备、家用电器、电动工具等，无强制性但影响销量。',
    desc: 'A/C-Tick是由澳大利亚通讯局（Australian Communications Authority，ACA）为通信设备发的认证标志。\n\n根据2001年政府发布的强制执行电磁兼容产品目录，主要涉及工业、科技、医用（ISM）设备，音像设备，家用电器设备，电动工具和电热器具，照明和类似设备，信息技术设备。\n\n无强制性，但产品做了这个认证后在市场上会有很多客户认可，销量也会更好。',
    products: ['工业科技医用设备', '音像设备', '家用电器', '电动工具', '电热器具', '照明设备', '信息技术设备'],
    warning: '',
    url: '',
  },
  {
    id: 17,
    name: 'BQB蓝牙认证',
    region: '全球',
    type: 'mandatory',
    short: '蓝牙技术联盟认证，产品外观标明蓝牙标志必须通过BQB认证，无有效期。',
    desc: '蓝牙技术由爱立信、诺基亚、东芝、IBM和英特尔联手发起，成立蓝牙技术联盟Bluetooth SIG进行管理与推广。BQB（蓝牙认证团体）是由BQRB授权的，为需要获得蓝牙产品认证的成员提供服务的团体。\n\n如果产品具有蓝牙功能并且在产品外观上标明蓝牙标志，必须通过BQB认证。\n\n蓝牙专利认证BQB没有有效期，只要SIG不淘汰当前的蓝牙版本即可持续使用。',
    products: ['蓝牙耳机', '蓝牙音箱', '蓝牙键盘鼠标', '手机', '平板电脑', '智能手表', '蓝牙模块'],
    warning: '没有认证的货物不要出现蓝牙标志，也不要申报蓝牙敏感字眼。',
    url: 'https://www.bluetooth.org/tpg/listings.cfm',
  },
  {
    id: 18,
    name: 'USB认证授权',
    region: '全球',
    type: 'voluntary',
    short: 'USB开发者论坛非强制性认证，USB Type-C接头要求进行USB认证。',
    desc: 'USB-IF认证是由USB开发者论坛提出的一种非强制性认证，一般为客户自愿申请。由苹果、微软、NEC等行业巨头参与制定的USB标准，在行业中起到带头作用。\n\nUSB Type-C接头都要求进行USB认证，因为要想使用USB标志，USB的采用者要通过一系列认证流程，先向美国USB协会申请成为USB会员，才能正式采用USB规范。',
    products: ['USB Type-C产品', '充电器', '数据线', '集线器', 'USB设备', '手机', '平板电脑'],
    warning: '',
    url: 'http://www.usb.org/results?q=60001218&submit=Search',
  },
  {
    id: 19,
    name: 'HDMI认证授权',
    region: '全球',
    type: 'mandatory',
    short: '高清多媒体接口认证，受专利保护，HDMI徽标仅在授权下方可使用。',
    desc: 'HDMI（High Definition Multimedia Interface）为目前业界与市场上广受认可的影音传输接口标准。\n\nHDMI不但支持更高的分辨率，更将所有讯号完全数字化，透过单一传输线将所有的影像和声音一起传输。\n\nHDMI是受专利保护的软件或硬件产品，HDMI徽标仅在授权下方可使用。采用者务必加入HDMI协会，并需成功通过产品的规格测试及HDMI协会认证。',
    products: ['电视机', '显示器', '投影仪', '机顶盒', '蓝光播放器', '游戏机', 'HDMI线缆'],
    warning: '',
    url: 'http://www.hdmi.org/',
  },
  {
    id: 20,
    name: 'UN38.3 & MSDS',
    region: '全球',
    type: 'mandatory',
    short: '锂电池运输安全认证，UN38.3为锂电池运输评估测试，MSDS为化学品安全说明书。',
    desc: 'UN38.3 是针对锂电池在运输过程中需要评估测试的标准，全称是《联合国危险物品运输试验和标准手册》第3部分38.3款。\n\n要求锂电池运输前必须通过：高度模拟、高低温循环、振动试验、冲击试验、55℃外短路、撞击试验、过充电试验、强制放电试验。\n\nMSDS（Material Safety Data Sheet）即化学品安全技术说明书，是化学品生产商和进口商用来阐明化学品理化特性和对使用者健康可能产生危害的文件。\n\n2017年新规：移动电源归类纯电池，UN38.3和MSDS按照成品做，不能以电芯做。',
    products: ['锂电池', '移动电源', '手机', '笔记本电脑', '电动工具', '无人机', '电动自行车'],
    warning: '2017年新规：移动电源归类纯电池，UN38.3和MSDS按照成品做，不能以电芯做。UN38.3需在指定有资质的第三方检测公司测试，MSDS可交给第三方检测也可工厂自行出具。',
    url: '',
  },
]

const REGIONS: Region[] = ['全部', '美国', '欧盟', '日本', '澳洲', '全球']

export default function CertificationDirectoryPage() {
  const [region, setRegion] = useState<Region>('全部')
  const [certType, setCertType] = useState<CertType>('all')
  const [query, setQuery] = useState('')
  const [active, setActive] = useState<Certification | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return DATA.filter((item) => {
      const regionMatch = region === '全部' || item.region === region
      const typeMatch = certType === 'all' || item.type === certType
      const searchMatch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.short.toLowerCase().includes(q) ||
        item.desc.toLowerCase().includes(q) ||
        item.region.toLowerCase().includes(q) ||
        item.products.some((product) => product.toLowerCase().includes(q))
      return regionMatch && typeMatch && searchMatch
    })
  }, [region, certType, query])

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-gradient-to-r from-slate-900 to-slate-700 p-6 text-white shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-white/10 p-3">
            <Globe className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">跨境认证大全</h2>
            <p className="mt-2 text-sm leading-6 text-slate-200">汇总美国、欧盟、日本、澳洲及全球常见跨境认证，支持按地区、类型和关键词快速检索。</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {REGIONS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setRegion(item)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${region === item ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                {item === '全部' ? '全部' : item}
              </button>
            ))}
          </div>

          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索认证名称或产品..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-100 pl-9 pr-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCertType('all')}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${certType === 'all' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-700'}`}
          >
            全部类型
          </button>
          <button
            type="button"
            onClick={() => setCertType('mandatory')}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${certType === 'mandatory' ? 'border-red-500 bg-red-500 text-white' : 'border-slate-200 text-slate-500 hover:border-red-300 hover:text-red-600'}`}
          >
            🔴 强制认证
          </button>
          <button
            type="button"
            onClick={() => setCertType('voluntary')}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${certType === 'voluntary' ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-200 text-slate-500 hover:border-emerald-300 hover:text-emerald-600'}`}
          >
            🟢 自愿认证
          </button>
        </div>

        <div className="mt-4 text-sm text-slate-500">共找到 <b className="text-slate-900">{filtered.length}</b> 项认证</div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl py-20 text-center text-slate-500">
            <div className="mb-3 text-5xl">🔍</div>
            <div>未找到相关认证，请尝试其他关键词</div>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((item) => {
              const typeClass = item.type === 'mandatory' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActive(item)}
                  className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="text-lg font-bold text-slate-900">{item.name}</div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${typeClass}`}>{item.type === 'mandatory' ? '强制' : '自愿'}</span>
                  </div>
                  <div className="mb-3 inline-flex rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">{item.region}</div>
                  <p className="line-clamp-3 text-sm leading-6 text-slate-600">{item.short}</p>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-1.5">
                      {item.products.slice(0, 3).map((product) => (
                        <span key={product} className="rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-500">
                          {product}
                        </span>
                      ))}
                      {item.products.length > 3 && <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-500">+{item.products.length - 3}</span>}
                    </div>
                    <span className="text-sm font-medium text-blue-600">详情 →</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </section>

      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => setActive(null)}>
          <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-bold text-slate-900">{active.name}</h3>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">{active.region}</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${active.type === 'mandatory' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                    {active.type === 'mandatory' ? '🔴 强制认证' : '🟢 自愿认证'}
                  </span>
                </div>
              </div>
              <button type="button" onClick={() => setActive(null)} className="rounded-full bg-slate-100 px-3 py-2 text-sm text-slate-500 hover:bg-slate-200">
                关闭
              </button>
            </div>

            <DetailSection title="认证说明">
              <p className="whitespace-pre-line text-sm leading-7 text-slate-700">{active.desc}</p>
            </DetailSection>

            <DetailSection title="适用产品">
              <div className="flex flex-wrap gap-2">
                {active.products.map((product) => (
                  <span key={product} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-700">
                    {product}
                  </span>
                ))}
              </div>
            </DetailSection>

            {active.warning && (
              <DetailSection title="注意事项">
                <div className="rounded-xl border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-sm leading-6 text-slate-700">⚠️ {active.warning}</div>
              </DetailSection>
            )}

            {active.url && (
              <DetailSection title="官方网站">
                <a href={active.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline">
                  <ExternalLink className="h-4 w-4" />
                  {active.url}
                </a>
              </DetailSection>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</div>
      {children}
    </section>
  )
}
