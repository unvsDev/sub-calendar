// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-purple; icon-glyph: credit-card;
// Sub Calendar 4 - by unvsDev
// Scriptable Widget for managing subscription items
// https://github.com/unvsDev/sub-calendar


const version = "4.0"

let fm = FileManager.iCloud()
let filePath = fm.documentsDirectory() + "/SubCalendarLocal.json"

let userData = {
  "subscriptions": [],
  "categories": ["비디오 및 엔터테인먼트", "음악", "게임 및 스트리밍",
    "도구와 생산성", "쇼핑", "클라우드 및 네트워크", "채팅 및 커뮤니케이션",
    "음식과 건강", "독서", "로컬 서비스", "인력 서비스 및 자원",
    "다중 구독", "생활과 편의", "정기 후원"],
  "tags": [],
  "notifications": {},
  "filterType": 0,
  "filterReversed": 0,
  "filterCategory": undefined,
  "showRelativeDate": 1,
  "showTags": 0,
  "enableNoti": 0,
  "notiDelay": 36000000,
  "widgetPresets": {
    "default": {
      "accentColor": "#2EDAB7",
      "filterType": 0,
      "filterReversed": 0,
      "filterCategory": undefined,
      "targetIdentifiers": [],
      "detailText": 0,
      "showPrice": 0,
    }
  },
  "service": {},
  "exchangeRates": {},
}

if(fm.fileExists(filePath)){
  if(fm.isFileStoredIniCloud(filePath) && !fm.isFileDownloaded(filePath)){
    await fm.downloadFileFromiCloud(filePath)
  }
  
  let temp = JSON.parse(fm.readString(filePath))
  for(index in temp){
    if(Object.keys(userData).indexOf(index) != -1){
      userData[index] = temp[index]
    }
  }
}

let dtDate = new Date()
let dt = dtDate.getTime()

const checkmark = "✓"
const cycleTypes = ["일마다", "개월마다", "년마다"]
const filterTypes = ["생성일", "다음 갱신일", "구독 이름", "구독 가격"]
const notiTypes = [["결제 하루 전", "결제 3일 전", "결제 7일 전"], [86400000, 259200000, 604800000]]
const detailTextTypes = ["결제 주기", "카테고리", "태그", "결제 수단"]

const supportedPayments = ["KB국민카드", "신한카드", "하나카드", "롯데카드", "BC카드", "NH농협카드", "삼성카드", "현대카드", "MasterCard", "Visa", "토스페이", "카카오페이", "PAYCO", "네이버페이", "스마일페이", "Pay"]

let exchangeRates = {}
let supportedExchangeTags = []

function getDateString(format, date){
  let df = new DateFormatter()
  df.locale = "ko-kr"
  df.dateFormat = format
  return df.string(date)
}

function getRelativeDateString(date, referenceDate){
  let rdf = new RelativeDateTimeFormatter()
  rdf.locale = "ko-kr"
  rdf.useNumericDateTimeStyle()
  return rdf.string(date, referenceDate)
}

function parseDateFromString(str) {
  var y = parseInt(str.substring(0, 4)),
      m = parseInt(str.substring(4, 6)) - 1,
      d = parseInt(str.substring(6, 8)),
      hr = parseInt(str.substring(8, 10)),
      min = parseInt(str.substring(10, 12));
  return new Date(y,m,d,hr,min);
}

Date.isLeapYear = function (year) { 
    return (((year % 4 === 0) && (year % 100 !== 0)) || (year % 400 === 0)); 
};

Date.getDaysInMonth = function (year, month) {
    return [31, (Date.isLeapYear(year) ? 29 : 28), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month];
};

Date.prototype.isLeapYear = function () { 
    return Date.isLeapYear(this.getFullYear()); 
};

Date.prototype.getDaysInMonth = function () { 
    return Date.getDaysInMonth(this.getFullYear(), this.getMonth());
};

Date.prototype.addMonths = function (value) {
    var n = this.getDate();
    this.setDate(1);
    this.setMonth(this.getMonth() + value);
    this.setDate(Math.min(n, this.getDaysInMonth()));
    return this;
};

function getLatestRenewal(startDate, cycle){
  let daCnt = cycle[0]
  let moCnt = cycle[1]
  let yrCnt = cycle[2]
  
  let renewDate = startDate
  let subCnt = 0
  let todayDate = new Date(new Date(dt).setHours(0,0,0,0))

  let recents = []
  
  while(todayDate.getTime() > renewDate.getTime()){
    if(yrCnt){ renewDate.setFullYear(renewDate.getFullYear() + yrCnt) }
    if(moCnt){ renewDate.addMonths(moCnt) }
    if(daCnt){ renewDate.setDate(renewDate.getDate() + daCnt) }
    recents.unshift(renewDate.getTime())
    subCnt++
  }
  
  return {
    "count": subCnt,
    "date": renewDate.getTime(),
    "recents": recents
  }
}

function getDayCount(targetDate, referenceDate){
  let todayDate = referenceDate ? referenceDate : new Date(dt).setHours(0,0,0,0)
  
  return (targetDate - todayDate) / (1000 * 60 * 60 * 24)
}

function getAvailableNotifier(targetDate, identifier){
  let tempNotifier = []
  if(userData.notifications[identifier] == undefined){
    userData.notifications[identifier] = [0,0,0]
    return []
  } else {
    for(index in userData.notifications[identifier]){
      if(userData.notifications[identifier][index]){
        tempNotifier.push(targetDate - notiTypes[1][index])
      }
    }
    return tempNotifier
  }
}

let pendingNotifier = []
let pendingNotiIdentifier = []
function fetchEarlyNotification(targetDates, nextChargeDate, identifier){
  for(index in targetDates){
    if(targetDates[index] < dt){ continue }
    let dataIndex = userData.subscriptions.findIndex(tempObject => tempObject.identifier == identifier)
    let subObject = userData.subscriptions[dataIndex]
    
    let noti = new Notification()
    noti.identifier = "SUBCALAT" + identifier + "AT" + targetDates[index]
    noti.title = subObject.title + " → " + getDayCount(nextChargeDate, targetDates[index]) + "일 전"
    noti.body = subObject.price.toLocaleString() + (subObject.currency == "KRW" ? "원" : (" " + subObject.currency)) + " · " + subObject.cycle + cycleTypes[subObject.cycleType].replace("마다", "") + (subObject.payment ? (" · " + subObject.payment) : "")
    
    pendingNotifier.push([noti, targetDates[index]])
    pendingNotiIdentifier.push(noti.identifier)
  }
}

// 서비스 데이터
async function fetchServiceData(){
  try {
    userData.service = await new Request("https://github.com/unvsDev/sub-calendar/raw/main/service.json").loadJSON()
  } catch(e){
    if(!Object.keys(userData.service).length){
      throw new Error("네트워크에 연결한 후 서브 캘린더를 다시 실행해 주세요.")
    }
  }
}

// 환율 데이터
async function fetchExchangeRate(){
  try {
    exchangeRates = await new Request("https://gist.github.com/unvsDev/3187f08a0334bde015eca83807c9a35e/raw/exRate.json").loadJSON()
    
    for(index in exchangeRates.data){
      supportedExchangeTags.push(exchangeRates.data[index].cur_unit)
    }
    
    userData.exchangeRates = exchangeRates
  } catch(e){
    if(!Object.keys(userData.exchangeRates).length){
      throw new Error("환율 데이터가 다운로드되지 않았습니다.")
    } else {
      // JSON 캐시 로드
      exchangeRates = userData.exchangeRates
      
      for(index in exchangeRates.data){
        supportedExchangeTags.push(exchangeRates.data[index].cur_unit)
      }
    }
  }
}

// Fetch network stage
await fetchServiceData()
await fetchExchangeRate()

// IDR, JPY는 100을 단위로 함
// 화폐 단위 선택
async function showCurrencyPicker(){
  let currencyResponse = -1
  
  let picker = new UITable()
  picker.showSeparators = true
  
  function loadPicker(){
    for(index in exchangeRates.data){
      // 환율 항목
      let exObject = new UITableRow()
      exObject.height = 60
      
      let exText = exObject.addText(exchangeRates.data[index].cur_unit.split("(")[0], exchangeRates.data[index].deal_bas_r == 1 ? "기본 화폐 단위" : (exchangeRates.data[index].cur_unit.indexOf("(100)") != -1 ? "100 " : "1 ") + exchangeRates.data[index].cur_unit.split("(")[0] + " 당 " + exchangeRates.data[index].deal_bas_r + "원")
      exText.titleFont = Font.boldMonospacedSystemFont(17)
      exText.subtitleColor = Color.dynamic(Color.gray(), Color.lightGray())
      
      picker.addRow(exObject)
      
      exObject.onSelect = (number) => {
        currencyResponse = exchangeRates.data[number].cur_unit
      }
    }
    
    let infoRow = new UITableRow()
    
    let infoText = infoRow.addText(getDateString("업데이트: yyyy년 M월 d일 HH:mm", parseDateFromString(exchangeRates.announceTime)))
    infoText.titleFont = Font.systemFont(13)
    infoText.titleColor = Color.dynamic(Color.gray(), Color.lightGray())
    
    picker.addRow(infoRow)
  }
  
  function refreshPicker(){
    picker.removeAllRows()
    loadPicker()
    picker.reload()
  }
  
  loadPicker()
  await picker.present()
  
  return currencyResponse
}

// 카테고리 선택
async function showCategoryPicker(target){
  let categoryResponse = -1
  
  let picker = new UITable()
  picker.showSeparators = true
  
  function loadPicker(){
    for(index in userData.categories){
      let ctSubject = userData.categories[index]
      let ctObject = new UITableRow()
      let ctText = ctObject.addText((target == ctSubject ? checkmark + " " : "") + ctSubject)
      
      let ctRemoveButton = ctObject.addButton("제거")
      ctRemoveButton.rightAligned()
      
      ctText.widthWeight = 90
      ctRemoveButton.widthWeight = 10
      
      ctRemoveButton.onTap = async () => {
        let alert = new Alert()
        alert.addDestructiveAction("Remove Category")
        alert.addCancelAction("Cancel")
        
        let response = await alert.presentSheet()
        
        if(response != -1){
          userData.categories.splice(userData.categories.indexOf(ctSubject), 1)
          
          // 기존 데이터에서 카테고리 제거 반영
          for(i in userData.subscriptions){
            if(userData.subscriptions[i].category == ctSubject){
              delete userData.subscriptions[i].category
            }
          }
          
          if(target == ctSubject){ categoryResponse = undefined }
          refreshPicker()
        }
      }
      
      picker.addRow(ctObject)
      
      ctObject.onSelect = (number) => {
        let temp = userData.categories[number]
        categoryResponse = temp == target ? undefined : temp
      }
    }
    
    let adderRow = new UITableRow()
    adderRow.dismissOnSelect = false
    
    let adderText = adderRow.addText("새 카테고리 추가")
    adderText.titleColor = Color.blue()
    
    picker.addRow(adderRow)
    
    adderRow.onSelect = async () => {
      let alert = new Alert()
      alert.title = "카테고리 이름을 입력하세요"
      alert.addTextField("", "")
      
      alert.addAction("OK")
      alert.addCancelAction("Cancel")
      
      let response = await alert.presentAlert()
      
      if(response != -1 && alert.textFieldValue() != "" && userData.categories.indexOf(alert.textFieldValue()) == -1){
        userData.categories.push(alert.textFieldValue())
        refreshPicker()
      }
    }
  }
  
  function refreshPicker(){
    picker.removeAllRows()
    loadPicker()
    picker.reload()
  }
  
  loadPicker()
  await picker.present()
  
  return categoryResponse
}

// 태그 선택
async function showTagPicker(target){
  let tagResponse = []
  if(target != undefined){ tagResponse = target }
  
  let picker = new UITable()
  picker.showSeparators = true
  
  function loadPicker(){
    for(index in userData.tags){
      let tgSubject = userData.tags[index]
      let tgObject = new UITableRow()
      tgObject.dismissOnSelect = false
      
      let tgText = tgObject.addText((tagResponse.indexOf(tgSubject) != -1 ? checkmark + " " : "") + tgSubject)
      
      let tgRemoveButton = tgObject.addButton("제거")
      tgRemoveButton.rightAligned()
      
      tgText.widthWeight = 90
      tgRemoveButton.widthWeight = 10
      
      tgRemoveButton.onTap = async () => {
        let alert = new Alert()
        alert.addDestructiveAction("Remove Tag")
        alert.addCancelAction("Cancel")
        
        let response = await alert.presentSheet()
        
        if(response != -1){
          userData.tags.splice(userData.tags.indexOf(tgSubject), 1)
          
          // 기존 데이터에서 태그 제거 반영
          for(i in userData.subscriptions){
            if(userData.subscriptions[i].tags.indexOf(tgSubject) != -1){
              userData.subscriptions[i].tags.splice(userData.subscriptions[i].tags.indexOf(tgSubject), 1)
            }
          }
          
          if(tagResponse.indexOf(tgSubject) != -1){
            tagResponse.splice(tagResponse.indexOf(tgSubject), 1)
          }
          refreshPicker()
        }
      }
      
      picker.addRow(tgObject)
      
      tgObject.onSelect = (number) => {
        let temp = userData.tags[number]
        if(tagResponse.indexOf(temp) == -1){ 
          tagResponse.push(temp)
        } else {
          tagResponse.splice(tagResponse.indexOf(temp), 1)
        }
        
        refreshPicker()
      }
    }
    
    let adderRow = new UITableRow()
    adderRow.dismissOnSelect = false
    
    let adderText = adderRow.addText("새 태그 추가")
    adderText.titleColor = Color.blue()
    
    picker.addRow(adderRow)
    
    adderRow.onSelect = async () => {
      let alert = new Alert()
      alert.title = "태그 이름을 입력하세요"
      alert.addTextField("", "")
      
      alert.addAction("OK")
      alert.addCancelAction("Cancel")
      
      let response = await alert.presentAlert()
      
      if(response != -1 && alert.textFieldValue() != "" && userData.tags.indexOf(alert.textFieldValue()) == -1){
        userData.tags.push(alert.textFieldValue())
        refreshPicker()
      }
    }
  }
  
  function refreshPicker(){
    picker.removeAllRows()
    loadPicker()
    picker.reload()
  }
  
  loadPicker()
  await picker.present()
  
  return tagResponse
}

// 구독 항목 선택
async function showSubscriptionsPicker(target){
  let subResponse = []
  if(target != undefined){ subResponse = target }
  
  let picker = new UITable()
  picker.showSeparators = true
  
  function loadPicker(){
    for(index in userData.subscriptions){
      let sbSubject = userData.subscriptions[index]
      let sbObject = new UITableRow()
      sbObject.dismissOnSelect = false
      
      let sbText = sbObject.addText((subResponse.indexOf(sbSubject.identifier) != -1 ? checkmark + " " : "") + sbSubject.title)
      
      picker.addRow(sbObject)
      
      sbObject.onSelect = (number) => {
        let temp = userData.subscriptions[number].identifier
        if(subResponse.indexOf(temp) == -1){ 
          subResponse.push(temp)
        } else {
          subResponse.splice(subResponse.indexOf(temp), 1)
        }
        
        refreshPicker()
      }
    }
  }
  
  function refreshPicker(){
    picker.removeAllRows()
    loadPicker()
    picker.reload()
  }
  
  loadPicker()
  await picker.present()
  
  return subResponse
}

// 구독 항목 추가/관리
async function showSubConfiguratorTable(preset){
  let requiredRemoveCnt = 1
  let dataIndex = -1
  if(preset){
    preset = JSON.parse(JSON.stringify(preset))
    dataIndex = userData.subscriptions.findIndex(tempObject => tempObject.identifier == preset.identifier)
  }
  
  let isNameChanged = false
  let subObject = preset ? preset : {
    "title": getDateString("yyyy/MM/dd HH:mm:ss", new Date()) + "에 생성된 구독",
    "price": 0,
    "currency": "KRW",
    "cycle": 1,
    "cycleType": 1,
    "nextChargeDate": new Date(dt).setHours(0,0,0,0),
    "identifier": new Date().getTime()
  }
  
  let getSubPriceString = () => {
    if(subObject.price == 0){ return "미정" }
    else if(subObject.currency == "KRW"){
      return subObject.price.toLocaleString() + "원"
    } else if(subObject.currency == "IDR(100)" || subObject.currency == "JPY(100)"){
      let productRate = subObject.price / 100 * parseFloat(exchangeRates.data[supportedExchangeTags.indexOf(subObject.currency)].deal_bas_r.replace(",", ""))
      productRate = Math.round(productRate/10) * 10
      return subObject.price + " " + subObject.currency.split("(")[0] + " (약 " + productRate.toLocaleString() + "원)"
    } else {
      let productRate = subObject.price * parseFloat(exchangeRates.data[supportedExchangeTags.indexOf(subObject.currency)].deal_bas_r.replace(",", ""))
      productRate = Math.round(productRate/10) * 10
      return subObject.price + " " + subObject.currency + " (약 " + productRate.toLocaleString() + "원)"
    }
  }
  
  let table = new UITable()
  table.showSeparators = true
  
  function loadTable(){
    let titleRow = new UITableRow()
    titleRow.height = 100
    titleRow.isHeader = true
    
    let titleText = titleRow.addText(preset ? "선택한 항목 편집" : "신규 항목 생성")
    titleText.titleFont = Font.boldSystemFont(27)
    
    table.addRow(titleRow)
    
    let subTitleRow = new UITableRow()
    subTitleRow.height = 60
    subTitleRow.dismissOnSelect = false
    
    let subTitleText = subTitleRow.addText("구독 이름", subObject.title)
    
    table.addRow(subTitleRow)
    
    subTitleRow.onSelect = async () => {
      let alert = new Alert()
      alert.title = "구독 이름을 입력하새요"
      alert.addTextField(subObject.title, isNameChanged ? subObject.title : "")
      
      alert.addAction("OK")
      alert.addCancelAction("Cancel")
      let response = await alert.presentAlert()
      
      if(response != -1 && alert.textFieldValue() != ""){
        subObject.title = alert.textFieldValue()
        isNameChanged = true
      }
      
      refreshTable()
    }
    
    let subPriceRow = new UITableRow()
    subPriceRow.height = 60
    subPriceRow.dismissOnSelect = false
    
    let subPriceText = subPriceRow.addText("구독 가격", getSubPriceString())
    
    let subPriceEditor = UITableCell.button("빠른 수정")
    subPriceEditor.rightAligned()
    
    if(subObject.price != 0){
      subPriceText.widthWeight = 80
      subPriceEditor.widthWeight = 20
      subPriceRow.addCell(subPriceEditor)
    }
    
    subPriceEditor.onTap = async () => {
      // 구독 가격 입력
      let alert2 = new Alert()
      alert2.title = "구독 가격을 입력하세요"
      let tf = alert2.addTextField("기준 통화: " + subObject.currency, "")
      tf.setDecimalPadKeyboard()
      
      alert2.addAction("OK")
      alert2.addCancelAction("Cancel")
      
      let response2 = await alert2.presentAlert()
      
      if(response2 != -1 && alert2.textFieldValue() != ""){
        subObject.price = parseFloat(alert2.textFieldValue())
      }
      
      refreshTable()
    }
    
    table.addRow(subPriceRow)
    
    subPriceRow.onSelect = async () => {
      let alert = new Alert()
      alert.title = "화폐 단위를 검토하세요"
      alert.addAction("KRW")
      alert.addAction("USD")
      alert.addAction("다른 통화 선택..")
      alert.addCancelAction("Cancel")
      
      let response = await alert.presentAlert()
      
      // 화폐 단위 선택
      if(response == -1){ throw -1 }
      else if(response == 0){
        subObject.currency = "KRW"
      } else if(response == 1){
        subObject.currency = "USD"
      } else if(response == 2){
        let userSelection = await showCurrencyPicker()
        if(userSelection == -1){ throw -1 }
        subObject.currency = userSelection
      }
      
      // 구독 가격 입력
      let alert2 = new Alert()
      alert2.title = "구독 가격을 입력하세요"
      let tf = alert2.addTextField("기준 통화: " + subObject.currency, "")
      tf.setDecimalPadKeyboard()
      
      alert2.addAction("OK")
      alert2.addCancelAction("Cancel")
      
      let response2 = await alert2.presentAlert()
      
      if(response2 != -1 && alert2.textFieldValue() != ""){
        subObject.price = parseFloat(alert2.textFieldValue())
      }
      
      refreshTable()
    }
    
    let subCycleRow = new UITableRow()
    subCycleRow.height = 60
    subCycleRow.dismissOnSelect = false
    
    subCycleRow.addText("결제 주기", subObject.cycle ? subObject.cycle + cycleTypes[subObject.cycleType] + " 갱신" : "눌러서 검토")
    
    table.addRow(subCycleRow)
    
    subCycleRow.onSelect = async () => {
      let alert = new Alert()
      alert.title = "주기 단위를 검토하세요"
      alert.addAction("1개월")
      alert.addAction("6개월")
      alert.addAction("1년")
      alert.addAction("다른 주기 선택..")
      alert.addCancelAction("Cancel")
      
      let response = await alert.presentAlert()
      
      if(response == -1){ throw -1 }
      else if(response == 0){
        subObject.cycleType = 1
        subObject.cycle = 1
      } else if(response == 1){
        subObject.cycleType = 1
        subObject.cycle = 6
      } else if(response == 2){
        subObject.cycleType = 2
        subObject.cycle = 1
      } else if(response == 3){
        let alert2 = new Alert()
        alert2.title = "맞춤 주기 단위"
        alert2.addAction("특정 일마다 갱신")
        alert2.addAction("특정 달마다 갱신")
        alert2.addAction("특정 년마다 갱신")
        alert2.addCancelAction("Cancel")
        
        let response2 = await alert2.presentAlert()
        
        if(response2 == -1){ throw -1 }
        
        let alert3 = new Alert()
        alert3.title = "맞춤 주기를 입력하세요"
        let tf = alert3.addTextField("특정 " + cycleTypes[response2], "")
        tf.setNumberPadKeyboard()
        alert3.addAction("OK")
        alert3.addCancelAction("Cancel")
        
        let response3 = await alert3.presentAlert()
        
        if(response3 != -1){
          subObject.cycleType = response2
          subObject.cycle = parseInt(alert3.textFieldValue())
        }
      }
      
      refreshTable()
    }
    
    let subInitDateRow = new UITableRow()
    subInitDateRow.height = 60
    subInitDateRow.dismissOnSelect = false
    
    subInitDateRow.addText("결제 시작일", getDateString("yyyy년 M월 d일", new Date(subObject.nextChargeDate)))
    
    table.addRow(subInitDateRow)
    
    subInitDateRow.onSelect = async () => {
      let dp = new DatePicker()
      dp.initialDate = new Date(subObject.nextChargeDate)
      
      try {
        let userSelection = await dp.pickDate()
        subObject.nextChargeDate = userSelection.setHours(0,0,0,0)
      } catch(e){ }
      
      refreshTable()
    }
    
    if(new Date(subObject.nextChargeDate).getDate() > 28){
      let infoRow = new UITableRow()
      infoRow.dismissOnSelect = false
      
      let infoText = infoRow.addText("• 미래 결제일이 달라질 수 있어요")
      infoText.titleFont = Font.systemFont(14)
      infoText.titleColor = Color.dynamic(Color.gray(), Color.lightGray())
      
      table.addRow(infoRow)
      
      infoRow.onSelect = async () => {
        let alert = new Alert()
        alert.title = "예상 결제일이 변경되는 경우"
        alert.message = "갱신일이 해당 월에 존재하지 않을 겅우, 월의 말일이 결제일(갱신일)로 지정됩니다."
        alert.addAction("Done")
        
        await alert.presentAlert()
      }
    }
    
    // 추가 항목
    let subCategoryRow = new UITableRow()
    subCategoryRow.height = 60
    subCategoryRow.dismissOnSelect = false
    
    subCategoryRow.addText("카테고리", subObject.category)
    
    subCategoryRow.onSelect = async () => {
      let userSelection = await showCategoryPicker(subObject.category)
      if(userSelection == -1){ throw -1 }
      subObject.category = userSelection
      
      refreshTable()
    }
    
    if(subObject.category != undefined){
      table.addRow(subCategoryRow)
    }
    
    let subTagRow = new UITableRow()
    subTagRow.height = 60
    subTagRow.dismissOnSelect = false
    
    subTagRow.addText("태그", subObject.tags != undefined ? (subObject.tags.length ? (subObject.tags.join(", ")) : "없음") : "없음")
    
    subTagRow.onSelect = async () => {
      let userSelection = await showTagPicker(subObject.tags)
      if(userSelection == -1){ throw -1 }
      subObject.tags = userSelection
      
      refreshTable()
    }
    
    if(subObject.tags != undefined){
      table.addRow(subTagRow)
    }
    
    async function showPaymentPicker(){
      let picker = new UITable()
      picker.showSeparators = true
      
      for(index in supportedPayments){
        let pmObject = new UITableRow()
        pmObject.addText((subObject.payment == supportedPayments[index] ? checkmark + " " : "") + supportedPayments[index])
        
        picker.addRow(pmObject)
        
        pmObject.onSelect = (number) => {
          subObject.payment = subObject.payment == supportedPayments[number] ? undefined : supportedPayments[number]
        }
      }
      
      await picker.present()
    }
    
    let subCardRow = new UITableRow()
    subCardRow.height = 60
    subCardRow.dismissOnSelect = false
    
    subCardRow.addText("결제 수단", subObject.payment)
    
    subCardRow.onSelect = async () => {
      await showPaymentPicker()
      refreshTable()
    }
    
    if(subObject.payment != undefined){
      table.addRow(subCardRow)
    }
    
    let subSharedRow = new UITableRow()
    subSharedRow.height = 60
    subSharedRow.dismissOnSelect = false
    
    subSharedRow.addText("공유 계정", subObject.sharedAccount)
    
    subSharedRow.onSelect = async () => {
      let alert = new Alert()
      alert.title = "공유 계정을 입력하세요"
      
      let tf = alert.addTextField("ID or Email Account", subObject.sharedAccount)
      tf.setEmailAddressKeyboard()
      
      alert.addAction("OK")
      alert.addCancelAction("Cancel")
      
      let response = await alert.presentAlert()
      
      if(response != -1){
        subObject.sharedAccount = alert.textFieldValue()
      }
      
      refreshTable()
    }
    
    if(subObject.sharedAccount != undefined){
      table.addRow(subSharedRow)
    }
    
    let subLocalRow = new UITableRow()
    subLocalRow.height = 60
    subLocalRow.dismissOnSelect = false
    
    subLocalRow.addText("소유자 정보", subObject.localAccount)
    
    subLocalRow.onSelect = async () => {
      let alert = new Alert()
      alert.title = "소유자 정보를 입력하세요"
      
      let tf = alert.addTextField("ID or Email Account", subObject.localAccount)
      tf.setEmailAddressKeyboard()
      
      alert.addAction("OK")
      alert.addCancelAction("Cancel")
      
      let response = await alert.presentAlert()
      
      if(response != -1){
        subObject.localAccount = alert.textFieldValue()
      }
      
      refreshTable()
    }
    
    if(subObject.localAccount != undefined){
      table.addRow(subLocalRow)
    }
    
    let subAdderRow = new UITableRow()
    subAdderRow.dismissOnSelect = false
    
    let subAdderText = subAdderRow.addText("속성 추가")
    subAdderText.titleColor = Color.blue()
    
    table.addRow(subAdderRow)
    
    subAdderRow.onSelect = async () => {
      let alert = new Alert()
      alert.addAction("카테고리")
      alert.addAction("태그")
      alert.addAction("결제 수단")
      alert.addAction("공유 계정")
      alert.addAction("소유자 정보")
      
      alert.addCancelAction("Cancel")
      
      let response = await alert.presentSheet()
      
      if(response == 0){
        subObject.category = ""
      } else if(response == 1){
        subObject.tags = []
      } else if(response == 2){
        await showPaymentPicker()
      } else if(response == 3){
        subObject.sharedAccount = ""
      } else if(response == 4){
        subObject.localAccount = ""
      }
      
      refreshTable()
    }
    
    if(!userData.subscriptions.length && Object.keys(subObject).length == 7){
      let guideRow = new UITableRow()
      guideRow.backgroundColor = new Color("133337")
      
      let guideText = guideRow.addText("↑ 카테고리, 공유 계정 등을 추가하세요")
      guideText.titleFont = Font.boldSystemFont(15)
      guideText.titleColor = new Color("ffffff")
      
      table.addRow(guideRow)
    }
    
    let subDoneRow = new UITableRow()
    subDoneRow.isHeader = true
    
    let subDoneText = subDoneRow.addText("저장")
    subDoneText.titleColor = Color.blue()
    
    subDoneRow.onSelect = () => {
      if(preset){
        userData.subscriptions[dataIndex] = subObject
      } else {
        userData.subscriptions.push(subObject)
      }
    }
    
    table.addRow(subDoneRow)
    
    if(preset){
      let temp = [0, 0, 0]
      temp[subObject.cycleType] = subObject.cycle
      let scRenewal = getLatestRenewal(new Date(subObject.nextChargeDate), temp)
      
      let nextDueDateRow = new UITableRow()
      nextDueDateRow.dismissOnSelect = false
      
      let nextDueDateText = nextDueDateRow.addText("다음 결제일: " + getDateString("yyyy년 M월 d일", new Date(scRenewal.date)))
      nextDueDateText.titleColor = Color.blue()
      
      table.addRow(nextDueDateRow)
      
      if(scRenewal.recents.length){
        nextDueDateRow.onSelect = async () => {
          let picker = new UITable()
          picker.showSeparators = true
          
          let totalPriceRow = new UITableRow()
          
          let totalPriceText = totalPriceRow.addText("지금까지 " + (subObject.price * scRenewal.recents.length).toLocaleString() + (subObject.currency == "KRW" ? "원" : (" " + subObject.currency)) + " 썼어요")
          totalPriceText.titleFont = Font.boldSystemFont(16)
          totalPriceText.titleColor = Color.dynamic(Color.gray(), Color.lightGray())
          
          picker.addRow(totalPriceRow)
          
          for(index in scRenewal.recents){
            let row = new UITableRow()
            row.height = 60
            
            let text = row.addText(getDateString("yyyy년 MM월 dd일", new Date(scRenewal.recents[index])), index > 0 ?  ("주기 " + (scRenewal.recents.length - index)) : "예정")
            text.titleFont = Font.mediumMonospacedSystemFont(15)
            text.subtitleFont = Font.mediumMonospacedSystemFont(14)
            text.subtitleColor = (scRenewal.recents.length - index) % 10 ? Color.dynamic(Color.gray(), Color.lightGray()) : Color.red()
            
            picker.addRow(row)
          }
          
          await picker.present()
        }
      }
      
      let removeRow = new UITableRow()
      if(requiredRemoveCnt){ removeRow.dismissOnSelect = false }
      
      let removeText = removeRow.addText(requiredRemoveCnt ? "두 번 눌러서 구독 삭제" : "다시 눌러서 구독 삭제")
      removeText.titleColor = Color.red()
      
      table.addRow(removeRow)
      
      removeRow.onSelect = () => {
        if(requiredRemoveCnt){
          requiredRemoveCnt--
          refreshTable()
        } else {
          userData.subscriptions.splice(dataIndex, 1)
          
          if(userData.notifications[subObject.identifier] != undefined){
            delete userData.notifications[subObject.identifier]
          }
        }
      }
    }
  }
  
  function refreshTable(){
    table.removeAllRows()
    loadTable()
    table.reload()
  }
  
  loadTable()
  await table.present()
}

// 시스템 알림 관리
async function showNotificationPicker(){
  let picker = new UITable()
  picker.showSeparators = true
  
  function loadPicker(){
    let titleRow = new UITableRow()
    titleRow.height = 100
    titleRow.isHeader = true
    
    let titleText = titleRow.addText("결제 전 미리 알림")
    titleText.titleFont = Font.boldSystemFont(27)
    
    picker.addRow(titleRow)
    
    let enableRow = new UITableRow()
    let enableText = enableRow.addText(userData.enableNoti ? "모든 알림 끄기" : "모든 알림 켜기")
    enableText.titleColor = userData.enableNoti ? Color.red() : Color.blue()
    
    picker.addRow(enableRow)
    
    enableRow.onSelect = () => {
      userData.enableNoti = 1 - userData.enableNoti
      userData.notifications = {}
    }
    
    let testNotiRow = new UITableRow()
    testNotiRow.dismissOnSelect = false
    
    let testNotiText = testNotiRow.addText("데모 알림 보기")
    testNotiText.titleColor = Color.blue()
    
    //picker.addRow(testNotiRow)
    
    testNotiRow.onSelect = async () => {
      let testNoti = new Notification()
      testNoti.title = "데모 구독 → 7일 전"
      testNoti.body = "7,900원 · 1개월 · 결제수단"
      await testNoti.schedule()
      
      let alert = new Alert()
      alert.title = "데모 알림이 전송되었습니다."
      alert.addAction("Done")
      
      await alert.presentAlert()
    }
    
    if(userData.enableNoti){
      let notiTimeRow = new UITableRow()
      notiTimeRow.dismissOnSelect = false
      
      let tempDate = new Date(new Date(dt).setHours(0,0,0,0) + userData.notiDelay)
      
      let notiTimeText = notiTimeRow.addText("알림 시간: 당일 " + getDateString("a hh:mm", tempDate))
      notiTimeText.titleColor = Color.blue()
      
      picker.addRow(notiTimeRow)
      
      notiTimeRow.onSelect = async () => {
        let dp = new DatePicker()
        dp.initialDate = tempDate
        try {
          let userInput = await dp.pickTime()
          userData.notiDelay = userInput.getHours() * 1000 * 60 * 60 + userInput.getMinutes() * 1000 * 60
        } catch(e){ }
        
        refreshPicker()
      }
      
      let totalObject = new UITableRow()
      totalObject.dismissOnSelect = false
      
      let totalText = totalObject.addText("전체 설정")
      totalText.titleColor = Color.blue()
      
      picker.addRow(totalObject)
      
      totalObject.onSelect = async () => {
        let alert = new Alert()
        for(index in notiTypes[1]){
          alert.addAction(notiTypes[0][index])
        } 
        alert.addDestructiveAction("모두 끄기")
        alert.addCancelAction("Cancel")
        
        let response = await alert.presentSheet()
        if(response != -1){
          for(index in userData.notifications){
            userData.notifications[index] = [0,0,0]
            if(response != notiTypes[1].length){
              userData.notifications[index][response] = 1
            }
          }
        }
        
        refreshPicker()
      }
      
      let seperator = new UITableRow()
      seperator.isHeader = true
      
      let spText = seperator.addText("• 개별 설정")
      spText.titleFont = Font.boldSystemFont(15)
      spText.titleColor = Color.dynamic(Color.gray(), Color.lightGray())
      
      picker.addRow(seperator)
      
      for(index in userData.subscriptions){
        let subObject = userData.subscriptions[index]
        
        if(userData.notifications[subObject.identifier] == undefined){
          userData.notifications[subObject.identifier] = [0, 0, 0]
        }
        
        let notiObject = new UITableRow()
        notiObject.dismissOnSelect = false
        
        let notiEnabled = userData.notifications[subObject.identifier].includes(1)
        let tempObject = []
        if(notiEnabled){
          notiObject.height = 70
          userData.notifications[subObject.identifier].forEach(function(element, index){
            if(element){ tempObject.push(notiTypes[0][index]) }
          })
        }
        
        let notiText = notiObject.addText(subObject.title, notiEnabled ? tempObject.join(", ") : null)
        if(notiEnabled){
          notiText.subtitleFont = Font.systemFont(14)
          notiText.subtitleColor = Color.dynamic(Color.gray(), Color.lightGray())
          
        }
        
        picker.addRow(notiObject)
        
        notiObject.onSelect = async () => {
          let alert = new Alert()
          for(index in notiTypes[1]){
            alert.addAction((userData.notifications[subObject.identifier][index] ? (checkmark + " ") : "") + notiTypes[0][index])
          } 
          alert.addCancelAction("Cancel")
          
          let response = await alert.presentSheet()
          if(response != -1){
            userData.notifications[subObject.identifier][response] = 1 - userData.notifications[subObject.identifier][response]
          }
          
          refreshPicker()
        }
      }
      
      let infoRow = new UITableRow()
      infoRow.dismissOnSelect = false
      
      let infoText = infoRow.addText("대기 중인 알림 보기")
      infoText.titleFont = Font.systemFont(13)
      infoText.titleColor = Color.dynamic(Color.gray(), Color.lightGray())
      
      picker.addRow(infoRow)
      
      infoRow.onSelect = async () => {
        let allPending = await Notification.allPending()
        allPending = allPending.filter(obj => obj.identifier.split("AT")[0] == "SUBCAL")
        
        let table = new UITable()
        table.showSeparators = true
        
        let infoRow = new UITableRow()
        infoRow.height = 60
        
        let infoText = infoRow.addText("• Scriptable → Settings → Notifications\n• Scheduled Identifiers")
        infoText.titleFont = Font.boldSystemFont(14)
        infoText.titleColor = Color.gray()
        
        table.addRow(infoRow)
        
        for(index in allPending){
          let row = new UITableRow()
          let text = row.addText(allPending[index].identifier)
          text.titleFont = Font.mediumMonospacedSystemFont(13)
          text.titleColor = Color.gray()
          
          table.addRow(row)
        }
        
        await table.present()
        
        refreshPicker()
      }
    }
  }
  
  function refreshPicker(){
    picker.removeAllRows()
    loadPicker()
    picker.reload()
  }
  
  loadPicker()
  await picker.present()
}

// 구독 항목 통계
async function showStatTable(){
  let table = new UITable()
  table.showSeparators = true
  
  function loadTable(){
    let titleRow = new UITableRow()
    titleRow.height = 100
    titleRow.isHeader = true
    
    let titleText = titleRow.addText("구독 통계")
    titleText.titleFont = Font.boldSystemFont(27)
    
    table.addRow(titleRow)
    
    let statObject = {
      "price": 0,
      "length": userData.subscriptions.length,
      "global": 0,
      "category": {},
      "payment": {},
    }
    
    // 구독 데이터에서 정보 추출, 구독 가격 환산
    for(index in userData.subscriptions){
      let subObject = userData.subscriptions[index]
      let initialPrice
      if(subObject.currency == "KRW"){
        initialPrice = subObject.price
      } else if(subObject.currency == "IDR(100)" || subObject.currency == "JPY(100)"){
        let productRate = subObject.price / 100 * parseFloat(exchangeRates.data[supportedExchangeTags.indexOf(subObject.currency)].deal_bas_r.replace(",", ""))
        initialPrice = productRate
        statObject.global++
      } else {
        let productRate = subObject.price * parseFloat(exchangeRates.data[supportedExchangeTags.indexOf(subObject.currency)].deal_bas_r.replace(",", ""))
        initialPrice = productRate
        statObject.global++
      }
      
      if(subObject.cycleType == 2){ initialPrice /= subObject.cycle * 12 }
      else if(subObject.cycleType == 1){ initialPrice /= subObject.cycle }
      else if(subObject.cycleType == 0){ initialPrice = initialPrice / subObject.cycle * 30 }
      
      statObject.price += initialPrice
      if(subObject.category != undefined && subObject.category != ""){
        if(statObject.category[subObject.category] == undefined){
          statObject.category[subObject.category] = initialPrice
        } else {
          statObject.category[subObject.category] += initialPrice
        }
      }
      
      if(subObject.payment != undefined && subObject.payment != ""){
        if(statObject.payment[subObject.payment] == undefined){
          statObject.payment[subObject.payment] = initialPrice
        } else {
          statObject.payment[subObject.payment] += initialPrice
        }
      }
    }
    
    statObject.price = Math.round(statObject.price / 10) * 10
    
    let statPriceRow = new UITableRow()
    statPriceRow.height = 70
    statPriceRow.dismissOnSelect = false
    
    let statPriceText = statPriceRow.addText("매월 평균 구독 가격*", "약 " + statObject.price.toLocaleString() + "원")
    statPriceText.titleFont = Font.boldSystemFont(14)
    statPriceText.subtitleFont = Font.boldMonospacedSystemFont(17)
    statPriceText.titleColor = Color.lightGray()
    
    table.addRow(statPriceRow)
    
    statPriceRow.onSelect = async () => {
      let alert = new Alert()
      alert.title = "매월 평균 구독 가격"
      alert.message = "외환의 경우 최근 환율에 따라 자동으로 변환되었습니다. 각각의 구독 가격이 1개월 기준으로 환산되어 반영되었습니다."
      alert.addAction("Done")
      await alert.presentAlert()
    }
    
    let statLensRow = new UITableRow()
    statLensRow.height = 70
    
    let statLensText = statLensRow.addText("총 구독 개수", statObject.length.toLocaleString())
    statLensText.titleFont = Font.boldSystemFont(14)
    statLensText.subtitleFont = Font.boldMonospacedSystemFont(17)
    statLensText.titleColor = Color.lightGray()
    
    table.addRow(statLensRow)
    
    let statGlobRow = new UITableRow()
    statGlobRow.height = 70
    
    let statGlobText = statGlobRow.addText("외화가 청구되는 구독 수", statObject.global.toLocaleString())
    statGlobText.titleFont = Font.boldSystemFont(14)
    statGlobText.subtitleFont = Font.boldMonospacedSystemFont(17)
    statGlobText.titleColor = Color.lightGray()
    
    table.addRow(statGlobRow)
    
    let seperator = new UITableRow()
    seperator.isHeader = true
    
    let spText = seperator.addText("• 카테고리별 구독 가격 (매월 평균)")
    spText.titleFont = Font.boldSystemFont(15)
    spText.titleColor = Color.dynamic(Color.gray(), Color.lightGray())
    
    table.addRow(seperator)
    
    // Sorting by Object.Keys(array)
    let sortedKeys = Object.keys(statObject.category).sort(function (a, b){
      return statObject.category[b] - statObject.category[a]
    })
    
    // 카테고리별 가격 내림차순으로 정렬
    for(index in sortedKeys){
      index = sortedKeys[index]
      
      let row = new UITableRow()
      row.height = 65
      
      let tempPrice = statObject.category[index]
      tempPrice = Math.round(tempPrice / 10) * 10
      
      let text = row.addText(index, tempPrice.toLocaleString() + "원")
      text.titleFont = Font.boldSystemFont(14)
      text.subtitleFont = Font.boldMonospacedSystemFont(17)
      text.titleColor = Color.lightGray()
      
      table.addRow(row)
    }
    
    let seperator2 = new UITableRow()
    seperator2.isHeader = true
    
    let spText2 = seperator2.addText("• 결제수단별 구독 가격 (매월 평균)")
    spText2.titleFont = Font.boldSystemFont(15)
    spText2.titleColor = Color.dynamic(Color.gray(), Color.lightGray())
    
    table.addRow(seperator2)
    
    // Sorting by Object.Keys(array)
    let sortedKeys2 = Object.keys(statObject.payment).sort(function (a, b){
      return statObject.payment[b] - statObject.payment[a]
    })
    
    // 결제수단별 가격 내림차순으로 정렬
    for(index in sortedKeys2){
      index = sortedKeys2[index]
      
      let row = new UITableRow()
      row.height = 65
      
      let tempPrice = statObject.payment[index]
      tempPrice = Math.round(tempPrice / 10) * 10
      
      let text = row.addText(index, tempPrice.toLocaleString() + "원")
      text.titleFont = Font.boldSystemFont(14)
      text.subtitleFont = Font.boldMonospacedSystemFont(17)
      text.titleColor = Color.lightGray()
      
      table.addRow(row)
    }
  }
  
  function refreshTable(){
    table.removeAllRows()
    loadTable()
    table.reload()
  }
  
  loadTable()
  await table.present()
}

// ListWidget 관리
async function showWidgetPreferenceTable(){
  let table = new UITable()
  table.showSeparators = true
  
  function loadTable(){
    let titleRow = new UITableRow()
    titleRow.height = 100
    titleRow.isHeader = true
    
    let titleText = titleRow.addText("홈 화면 및 잠금 화면 위젯")
    titleText.titleFont = Font.boldSystemFont(27)
    
    table.addRow(titleRow)
    
    let previewRow = new UITableRow()
    previewRow.dismissOnSelect = false
    
    let previewText = previewRow.addText("위젯 미리보기")
    previewText.titleColor = Color.blue()
    
    table.addRow(previewRow)
    
    previewRow.onSelect = async () => {
      let alert = new Alert()
      alert.addAction("소형 위젯")
      alert.addAction("중형 위젯")
      alert.addAction("대형 위젯")
      alert.addAction("잠금화면 위젯")
      alert.addCancelAction("Cancel")
      
      let response = await alert.presentAlert()
      if(response != -1){
        let widgetSizes = ["small", "medium", "large", "accessoryRectangular"]
        buildWidget(widgetSizes[response], true)
      }
    }
    
    let seperator = new UITableRow()
    seperator.isHeader = true
    
    let spText = seperator.addText("• 기본 설정")
    spText.titleFont = Font.boldSystemFont(15)
    spText.titleColor = Color.dynamic(Color.gray(), Color.lightGray())
    
    table.addRow(seperator)
    
    let prefRow = new UITableRow()
    prefRow.height = 60
    prefRow.dismissOnSelect = false
    
    let prefText = prefRow.addText("강조 색상", userData.widgetPresets.default.accentColor)
    
    table.addRow(prefRow)
    
    prefRow.onSelect = async () => {
      let alert = new Alert()
      alert.title = "강조 색상"
      alert.addTextField(userData.widgetPresets.default.accentColor, userData.widgetPresets.default.accentColor)
      alert.addAction("OK")
      alert.addCancelAction("Cancel")
      let response = await alert.presentAlert()
      if(response != -1){ userData.widgetPresets.default.accentColor = alert.textFieldValue() }
      refreshTable()
    }
    
    let prefRow2 = new UITableRow()
    prefRow2.height = 60
    prefRow2.dismissOnSelect = false
    
    let prefText2 = prefRow2.addText("정렬 방식", (userData.widgetPresets.default.filterReversed ? "↓" : "↑") + " " + filterTypes[userData.widgetPresets.default.filterType])
    
    table.addRow(prefRow2)
    
    prefRow2.onSelect = async () => {
      let alert = new Alert()
      for(index in filterTypes){
        alert.addAction((userData.widgetPresets.default.filterType == index ? checkmark : "") + " " + filterTypes[index])
      }
      alert.addCancelAction("Cancel")
      
      let response = await alert.presentSheet()
      
      if(response == -1){ throw -1 }
      
      let reverseTypes = ["오름차순", "내림차순"]
      let alert2 = new Alert()
      for(index in reverseTypes){
        alert2.addAction((userData.widgetPresets.default.filterReversed == index ? checkmark : "") + " " + reverseTypes[index])
      }
      alert2.addCancelAction("Cancel")
      
      let response2 = await alert2.presentSheet()
      
      if(response2 == -1){ throw -1 }
      
      userData.widgetPresets.default.filterType = response
      userData.widgetPresets.default.filterReversed = response2
      
      refreshTable()
    }
    
    let prefRow3 = new UITableRow()
    prefRow3.height = 60
    prefRow3.dismissOnSelect = false
    
    let prefText3 = prefRow3.addText("카테고리 필터", userData.widgetPresets.default.filterCategory == undefined ? "모두 표시" : userData.widgetPresets.default.filterCategory)
    
    table.addRow(prefRow3)
    
    prefRow3.onSelect = async () => {
      let userSelection = await showCategoryPicker(userData.widgetPresets.default.filterCategory)
      if(userSelection == -1){ throw -1 }
      userData.widgetPresets.default.filterCategory = userSelection
      refreshTable()
    }
    
    let prefRow4 = new UITableRow()
    prefRow4.height = 60
    prefRow4.dismissOnSelect = false
    
    let prefText4 = prefRow4.addText("구독 항목 필터", userData.widgetPresets.default.targetIdentifiers.length > 0 ? (userData.widgetPresets.default.targetIdentifiers.length + "개 선택됨") : "모두 표시")
    
    table.addRow(prefRow4)
    
    prefRow4.onSelect = async () => {
      let userSelection = await showSubscriptionsPicker(userData.widgetPresets.default.targetIdentifiers)
      if(userSelection == -1){ throw -1 }
      userData.widgetPresets.default.targetIdentifiers = userSelection
      refreshTable()
    }
    
    let prefRow5 = new UITableRow()
    prefRow5.height = 60
    prefRow5.dismissOnSelect = false
    
    let prefText5 = prefRow5.addText("보조 텍스트", detailTextTypes[userData.widgetPresets.default.detailText])
    
    table.addRow(prefRow5)
    
    prefRow5.onSelect = async () => {
      let alert = new Alert()
      for(index in detailTextTypes){
        alert.addAction((userData.widgetPresets.default.detailText == index ? checkmark : "") + " " + detailTextTypes[index])
      }
      alert.addCancelAction("Cancel")
      
      let response = await alert.presentSheet()
      
      if(response == -1){ throw -1 }
      
      userData.widgetPresets.default.detailText = response
      refreshTable()
    }
    
    let prefRow6 = new UITableRow()
    prefRow6.height = 60
    prefRow6.dismissOnSelect = false
    
    let prefText6 = prefRow6.addText("예상 결제 금액 표시", userData.widgetPresets.default.showPrice ? "켬" : "끔")
    
    table.addRow(prefRow6)
    
    prefRow6.onSelect = async () => {
      let alert = new Alert()
      alert.addAction("결제 금액 표시 안 함")
      alert.addAction("결제 금액 표시")
      alert.addCancelAction("Cancel")
      
      let response = await alert.presentAlert()
      
      if(response == -1){ throw -1 }
      
      userData.widgetPresets.default.showPrice = response
      refreshTable()
    }
    
    async function showPresetEditor(target){
      let picker = new UITable()
      picker.showSeparators = true
      
      function loadPicker(){
        let previewRow = new UITableRow()
        previewRow.dismissOnSelect = false
        
        let previewText = previewRow.addText("위젯 미리보기")
        previewText.titleColor = Color.blue()
        
        picker.addRow(previewRow)
        
        previewRow.onSelect = async () => {
          let alert = new Alert()
          alert.addAction("소형 위젯")
          alert.addAction("중형 위젯")
          alert.addAction("대형 위젯")
          alert.addAction("잠금화면 위젯")
          alert.addCancelAction("Cancel")
          
          let response = await alert.presentAlert()
          if(response != -1){
            let widgetSizes = ["small", "medium", "large", "accessoryRectangular"]
            buildWidget(widgetSizes[response], true, target)
          }
        }
        
        let prefRow = new UITableRow()
        prefRow.height = 60
        prefRow.dismissOnSelect = false
        
        let prefText = prefRow.addText("강조 색상", userData.widgetPresets[target].accentColor)
        
        picker.addRow(prefRow)
        
        prefRow.onSelect = async () => {
          let alert = new Alert()
          alert.title = "강조 색상"
          alert.addTextField(userData.widgetPresets[target].accentColor, userData.widgetPresets[target].accentColor)
          alert.addAction("OK")
          alert.addCancelAction("Cancel")
          let response = await alert.presentAlert()
          if(response != -1){ userData.widgetPresets[target].accentColor = alert.textFieldValue() }
          refreshPicker()
        }
        
        let prefRow2 = new UITableRow()
        prefRow2.height = 60
        prefRow2.dismissOnSelect = false
        
        let prefText2 = prefRow2.addText("정렬 방식", (userData.widgetPresets[target].filterReversed ? "↓" : "↑") + " " + filterTypes[userData.widgetPresets[target].filterType])
        
        picker.addRow(prefRow2)
        
        prefRow2.onSelect = async () => {
          let alert = new Alert()
          for(index in filterTypes){
            alert.addAction((userData.widgetPresets[target].filterType == index ? checkmark : "") + " " + filterTypes[index])
          }
          alert.addCancelAction("Cancel")
          
          let response = await alert.presentSheet()
          
          if(response == -1){ throw -1 }
          
          let reverseTypes = ["오름차순", "내림차순"]
          let alert2 = new Alert()
          for(index in reverseTypes){
            alert2.addAction((userData.widgetPresets[target].filterReversed == index ? checkmark : "") + " " + reverseTypes[index])
          }
          alert2.addCancelAction("Cancel")
          
          let response2 = await alert2.presentSheet()
          
          if(response2 == -1){ throw -1 }
          
          userData.widgetPresets[target].filterType = response
          userData.widgetPresets[target].filterReversed = response2
          
          refreshPicker()
        }
        
        let prefRow3 = new UITableRow()
        prefRow3.height = 60
        prefRow3.dismissOnSelect = false
        
        let prefText3 = prefRow3.addText("카테고리 필터", userData.widgetPresets[target].filterCategory == undefined ? "모두 표시" : userData.widgetPresets[target].filterCategory)
        
        picker.addRow(prefRow3)
        
        prefRow3.onSelect = async () => {
          let userSelection = await showCategoryPicker(userData.widgetPresets[target].filterCategory)
          if(userSelection == -1){ throw -1 }
          userData.widgetPresets[target].filterCategory = userSelection
          refreshPicker()
        }
        
        let prefRow4 = new UITableRow()
        prefRow4.height = 60
        prefRow4.dismissOnSelect = false
        
        let prefText4 = prefRow4.addText("구독 항목 필터", userData.widgetPresets[target].targetIdentifiers.length > 0 ? (userData.widgetPresets[target].targetIdentifiers.length + "개 선택됨") : "모두 표시")
        
        picker.addRow(prefRow4)
        
        prefRow4.onSelect = async () => {
          let userSelection = await showSubscriptionsPicker(userData.widgetPresets[target].targetIdentifiers)
          if(userSelection == -1){ throw -1 }
          userData.widgetPresets[target].targetIdentifiers = userSelection
          refreshPicker()
        }
        
        let prefRow5 = new UITableRow()
        prefRow5.height = 60
        prefRow5.dismissOnSelect = false
        
        let prefText5 = prefRow5.addText("보조 텍스트", detailTextTypes[userData.widgetPresets[target].detailText])
        
        picker.addRow(prefRow5)
        
        prefRow5.onSelect = async () => {
          let alert = new Alert()
          for(index in detailTextTypes){
            alert.addAction((userData.widgetPresets[target].detailText == index ? checkmark : "") + " " + detailTextTypes[index])
          }
          alert.addCancelAction("Cancel")
          
          let response = await alert.presentSheet()
          
          if(response == -1){ throw -1 }
          
          userData.widgetPresets[target].detailText = response
          refreshPicker()
        }
        
        let prefRow6 = new UITableRow()
        prefRow6.height = 60
        prefRow6.dismissOnSelect = false
        
        let prefText6 = prefRow6.addText("예상 결제 금액 표시", userData.widgetPresets[target].showPrice ? "켬" : "끔")
        
        picker.addRow(prefRow6)
        
        prefRow6.onSelect = async () => {
          let alert = new Alert()
          alert.addAction("결제 금액 표시 안 함")
          alert.addAction("결제 금액 표시")
          alert.addCancelAction("Cancel")
          
          let response = await alert.presentAlert()
          
          if(response == -1){ throw -1 }
          
          userData.widgetPresets[target].showPrice = response
          refreshPicker()
        }
        
        let removeRow = new UITableRow()
        
        let removeText = removeRow.addText("선택한 구성 삭제")
        removeText.titleColor = Color.red()
        
        picker.addRow(removeRow)
        
        removeRow.onSelect = () => {
          delete userData.widgetPresets[target]
        }
      }
      
      function refreshPicker(){
        picker.removeAllRows()
        loadPicker()
        picker.reload()
      }
      
      loadPicker()
      await picker.present()
    }
    
    let seperator2 = new UITableRow()
    seperator2.isHeader = true
    
    let spText2 = seperator2.addText("• 모든 위젯 구성")
    spText2.titleFont = Font.boldSystemFont(15)
    spText2.titleColor = Color.dynamic(Color.gray(), Color.lightGray())
    
    table.addRow(seperator2)
    
    let adderRow = new UITableRow()
    adderRow.dismissOnSelect = false
    
    let adderText = adderRow.addText("위젯 구성 추가")
    adderText.titleColor = Color.blue()
    
    table.addRow(adderRow)
    
    adderRow.onSelect = async () => {
      let alert = new Alert()
      alert.title = "구성 이름 입력"
      alert.message = "사용자 구성을 위젯에 적용하려면 \"위젯 편집\"을 누르고, \"Parameter\"에 해당 구성 이름을 입력하세요."
      alert.addTextField("", "")
      alert.addAction("OK")
      alert.addCancelAction("Cancel")
      let response = await alert.presentAlert()
      
      if(response != -1){
        if(Object.keys(userData.widgetPresets).indexOf(alert.textFieldValue()) != -1){
          let alert2 = new Alert()
          alert2.title = "구성 이름이 중복됨"
          alert2.message = "사용자 구성은 중복되는 이름을 사용할 수 없습니다. 다른 이름으로 다시 시도하세요."
          alert2.addAction("Done")
          await alert2.presentAlert()
          
          throw -1
        }
        
        userData.widgetPresets[alert.textFieldValue()] = {
          "accentColor": "#2EDAB7",
          "filterType": 0,
          "filterReversed": 0,
          "filterCategory": undefined,
          "targetIdentifiers": [],
          "detailText": 0,
          "showPrice": 0,
        }
      }
      
      refreshTable()
    }
    
    for(index in userData.widgetPresets){
      if(index == "default"){ continue }
      let prSubject = index
      let row = new UITableRow()
      row.dismissOnSelect = false
      
      row.addText(index)
      
      table.addRow(row)
      
      row.onSelect = async () => {
        await showPresetEditor(prSubject)
        refreshTable()
      }
    }
  }
  
  function refreshTable(){
    table.removeAllRows()
    loadTable()
    table.reload()
  }
  
  loadTable()
  await table.present()
}

// 구독 항목 List View
async function showSubListViewTable(preset){
  let editor = new UITable()
  editor.showSeparators = true
  
  function loadEditor(){
    // 데이터 정합성 확인 (Tags, Categories)
    for(i in userData.subscriptions){
      if(userData.categories.indexOf(userData.subscriptions[i].category) == -1){
        delete userData.subscriptions[i].category
      }
      for(j in userData.subscriptions[i].tags){
        if(userData.tags.indexOf(userData.subscriptions[i].tags[j]) == -1){
          userData.subscriptions[i].tags.splice(userData.subscriptions[i].tags.indexOf(userData.subscriptions[i].tags[j]), 1)
        }
      }
      
      if(userData.subscriptions[i].tags != undefined){
        if(!userData.subscriptions[i].tags.length){ delete userData.subscriptions[i].tags }
      }
    }
    
    let titleRow = new UITableRow()
    titleRow.height = 100
    titleRow.isHeader = true
    
    let titleText = titleRow.addText(userData.subscriptions.length + "개의 구독")
    titleText.titleFont = Font.boldSystemFont(27)
    
    let categoryButton = titleRow.addButton(userData.filterCategory == undefined ? "카테고리" : userData.filterCategory)
    let filterButton = titleRow.addButton((userData.filterReversed ? "↓" : "↑") + " " + filterTypes[userData.filterType])
    
    categoryButton.centerAligned()
    filterButton.centerAligned()
    
    titleText.widthWeight = 50
    categoryButton.widthWeight = 25
    filterButton.widthWeight = 25
    
    categoryButton.onTap = async () => {
      let userSelection = await showCategoryPicker(userData.filterCategory)
      if(userSelection == -1){ throw -1 }
      userData.filterCategory = userSelection
      refreshEditor()
    }
    
    filterButton.onTap = async () => {
      let alert = new Alert()
      for(index in filterTypes){
        alert.addAction((userData.filterType == index ? checkmark : "") + " " + filterTypes[index])
      }
      alert.addCancelAction("Cancel")
      
      let response = await alert.presentSheet()
      
      if(response == -1){ throw -1 }
      
      let reverseTypes = ["오름차순", "내림차순"]
      let alert2 = new Alert()
      for(index in reverseTypes){
        alert2.addAction((userData.filterReversed == index ? checkmark : "") + " " + reverseTypes[index])
      }
      alert2.addCancelAction("Cancel")
      
      let response2 = await alert2.presentSheet()
      
      if(response2 == -1){ throw -1 }
      
      userData.filterType = response
      userData.filterReversed = response2
      
      refreshEditor()
    }
    
    editor.addRow(titleRow)
    
    let adderRow = new UITableRow()
    adderRow.dismissOnSelect = false
    
    let adderText = adderRow.addText("구독 항목 추가")
    adderText.titleColor = Color.blue()
    
    editor.addRow(adderRow)
    
    adderRow.onSelect = async () => {
      await showSubConfiguratorTable()
      refreshEditor()
    }
    
    if(!userData.subscriptions.length){
      let guideRow = new UITableRow()
      guideRow.backgroundColor = new Color("133337")
      
      let guideText = guideRow.addText("↑ 여기를 눌러 첫 구독을 추가하세요")
      guideText.titleFont = Font.boldSystemFont(15)
      guideText.titleColor = new Color("ffffff")
      
      editor.addRow(guideRow)
    }
    
    // 앱 업데이트 멘션
    if(userData.service.version != version){
      let updateRow = new UITableRow()
      updateRow.dismissOnSelect = false
      updateRow.backgroundColor = new Color("#38357A")
      
      let updateText = updateRow.addText("앱 업데이트가 가능합니다")
      updateText.titleColor = new Color("#FFFFFF")
      
      editor.addRow(updateRow)
      
      updateRow.onSelect = () => {
        Safari.openInApp("https://github.com/unvsDev/sub-calendar/releases", false)
      }
    }
    
    // userData에서 array 복사
    let localSubscriptions = JSON.parse(JSON.stringify(userData.subscriptions))
    
    // 카테고리 Filter
    if(userData.filterCategory != undefined){
      localSubscriptions = localSubscriptions.filter(tempObject => tempObject.category == userData.filterCategory)
    }
    
    // 사용자 정의 조건 Filter
    if(userData.filterType == 1){
      localSubscriptions.sort(function (tempObjectA, tempObjectB){
        let temp = [0, 0, 0]
        temp[tempObjectA.cycleType] = tempObjectA.cycle
        let scRenewalA = getLatestRenewal(new Date(tempObjectA.nextChargeDate), temp)
        
        temp = [0, 0, 0]
        temp[tempObjectB.cycleType] = tempObjectB.cycle
        let scRenewalB = getLatestRenewal(new Date(tempObjectB.nextChargeDate), temp)
        
        return scRenewalA.date - scRenewalB.date
      })
    } else if(userData.filterType == 2){
      localSubscriptions.sort(function (tempObjectA, tempObjectB){
        return ('' + tempObjectA.title).localeCompare(tempObjectB.title)
      })
    } else if(userData.filterType == 3){
      localSubscriptions.sort(function (tempObjectA, tempObjectB){
        let tempPriceA, tempPriceB
        
        if(tempObjectA.currency == "IDR(100)" || tempObjectA.currency == "JPY(100)"){
          tempPriceA = tempObjectA.price / 100 * parseFloat(exchangeRates.data[supportedExchangeTags.indexOf(tempObjectA.currency)].deal_bas_r.replace(",", ""))
        } else {
          tempPriceA = tempObjectA.price * parseFloat(exchangeRates.data[supportedExchangeTags.indexOf(tempObjectA.currency)].deal_bas_r.replace(",", ""))
        }
        
        if(tempObjectB.currency == "IDR(100)" || tempObjectB.currency == "JPY(100)"){
          tempPriceB = tempObjectB.price / 100 * parseFloat(exchangeRates.data[supportedExchangeTags.indexOf(tempObjectB.currency)].deal_bas_r.replace(",", ""))
        } else {
          tempPriceB = tempObjectB.price * parseFloat(exchangeRates.data[supportedExchangeTags.indexOf(tempObjectB.currency)].deal_bas_r.replace(",", ""))
        }
        
        return tempPriceA - tempPriceB
      })
    }
    
    if(userData.filterReversed){
      localSubscriptions = localSubscriptions.reverse()
    }
    
    pendingNotifier = []
    pendingNotiIdentifier = []
    for(index in localSubscriptions){
      let subObject = localSubscriptions[index]
      
      let getSubPriceString = () => {
        if(subObject.price == 0){ return "가격 미정" }
        else if(subObject.currency == "KRW"){
          return subObject.price.toLocaleString() + "원"
        } else if(subObject.currency == "IDR(100)" || subObject.currency == "JPY(100)"){
          let productRate = subObject.price / 100 * parseFloat(exchangeRates.data[supportedExchangeTags.indexOf(subObject.currency)].deal_bas_r.replace(",", ""))
          productRate = Math.round(productRate/10) * 10
          return subObject.price + " " + subObject.currency.split("(")[0] + " (약 " + productRate.toLocaleString() + "원)"
        } else {
          let productRate = subObject.price * parseFloat(exchangeRates.data[supportedExchangeTags.indexOf(subObject.currency)].deal_bas_r.replace(",", ""))
          productRate = Math.round(productRate/10) * 10
          return subObject.price + " " + subObject.currency + " (약 " + productRate.toLocaleString() + "원)"
        }
      }
      
      let temp = [0, 0, 0]
      temp[subObject.cycleType] = subObject.cycle
      let scRenewal = getLatestRenewal(new Date(subObject.nextChargeDate), temp)
      
      let subCycleString = subObject.cycle + cycleTypes[subObject.cycleType].replace("마다", " 정기구독")
      
      let scNotifier = getAvailableNotifier(scRenewal.date, subObject.identifier)
      fetchEarlyNotification(scNotifier, scRenewal.date, subObject.identifier)
      
      let scObjRow = new UITableRow()
      scObjRow.height = userData.showTags && subObject.tags != undefined ? 85 : 70
      scObjRow.dismissOnSelect = false
      
      let scObjText = scObjRow.addText(subObject.title, `${getSubPriceString()} · ${subCycleString} · ${!getDayCount(new Date(scRenewal.date)) ? "오늘 결제" : (userData.showRelativeDate ? getRelativeDateString(new Date(scRenewal.date), new Date(new Date(dt).setHours(0,0,0,0))) : getDateString("yyyy년 M월 d일", new Date(scRenewal.date)))}` + (userData.showTags && subObject.tags != undefined ? "\n" + subObject.tags.join(" · ") : ""))
      scObjText.titleFont = Font.systemFont(17)
      scObjText.subtitleFont = Font.systemFont(14)
      scObjText.subtitleColor = Color.dynamic(Color.gray(), Color.lightGray())
      
      editor.addRow(scObjRow)
      
      scObjRow.onSelect = async () => {
        await showSubConfiguratorTable(subObject)
        refreshEditor()
      }
    }
    
    if(userData.subscriptions.length == 1){
      let guideRow = new UITableRow()
      guideRow.backgroundColor = new Color("133337")
      
      let guideText = guideRow.addText("↑ 구독 항목을 눌러 편집할 수 있어요")
      guideText.titleFont = Font.boldSystemFont(15)
      guideText.titleColor = new Color("ffffff")
      
      editor.addRow(guideRow)
    }
    
    if(userData.subscriptions.length){
      let statRow = new UITableRow()
      statRow.dismissOnSelect = false
      
      let statText = statRow.addText("통계 보기")
      statText.titleColor = Color.blue()
      
      editor.addRow(statRow)
      
      statRow.onSelect = async () => {
        await showStatTable()
        refreshEditor()
      }
      
      let alertRow = new UITableRow()
      alertRow.dismissOnSelect = false
      
      let alertText = alertRow.addText("결제 전 미리 알리기")
      alertText.titleColor = Color.blue()
      
      editor.addRow(alertRow)
      
      alertRow.onSelect = async () => {
        await showNotificationPicker()
        refreshEditor()
      }
      
      let widgetPrefRow = new UITableRow()
      widgetPrefRow.dismissOnSelect = false
      
      let widgetPrefText = widgetPrefRow.addText("위젯 설정")
      widgetPrefText.titleColor = Color.blue()
      
      editor.addRow(widgetPrefRow)
      
      widgetPrefRow.onSelect = async () => {
        await showWidgetPreferenceTable()
        refreshEditor()
      }
    }
    
    let infoRow = new UITableRow()
    infoRow.dismissOnSelect = false
    
    let infoText = infoRow.addText("Sub Calendar v" + version + " for Everyone · 설정 보기")
    
    infoText.titleFont = Font.systemFont(13)
    infoText.titleColor = Color.dynamic(Color.gray(), Color.lightGray())
    
    editor.addRow(infoRow)
    
    infoRow.onSelect = async () => {
      let alert = new Alert()
      alert.addAction("갱신일 표시: " + (userData.showRelativeDate ? "남은 기간" : "다음 날짜"))
      alert.addAction("태그 표시: " + (userData.showTags ? "켬" : "끔"))
      alert.addAction("구독 항목 내보내기")
      alert.addAction("구독 항목 가져오기")
      alert.addDestructiveAction("구독 항목 모두 삭제")
      alert.addDestructiveAction("모든 데이터 삭제")
      alert.addCancelAction("Cancel")
      
      let response = await alert.presentAlert()
      
      if(response == 0){
        userData.showRelativeDate = 1 - userData.showRelativeDate
      } else if(response == 1){
        userData.showTags = 1 - userData.showTags
      } else if(response == 2){
        let alert2 = new Alert()
        alert2.title = "내보내기 유형"
        alert2.message = "앱 내 복원은 JSON 형식만 지원합니다."
        alert2.addAction("CSV로 내보내기")
        alert2.addAction("JSON으로 내보내기")
        alert2.addCancelAction("Cancel")
        
        let response2 = await alert2.presentAlert()
        
        if(response2 == 0){
          await DocumentPicker.exportString(exportSubDataToCSV(), "SubCalendarBackup-" + getDateString("yyyyMMddHHmmss", new Date()) + ".csv")
        } else if(response2 == 1){
          await DocumentPicker.exportString(exportSubDataToJSON(), "SubCalendarBackup-" + getDateString("yyyyMMddHHmmss", new Date()) + ".json")
        }
        
      } else if(response == 3){
        let alert2 = new Alert()
        alert2.title = "가져오기 유형"
        alert2.message = "파일 앱에서 로컬 데이터를 복원하세요."
        // alert2.addAction("CSV에서 가져오기")
        alert2.addAction("JSON에서 가져오기")
        alert2.addCancelAction("Cancel")
        
        let response2 = await alert2.presentAlert()
        
        if(response2 == 0){
          try {
            let dp = await DocumentPicker.open(["public.json"])
            for(index in dp){
              await importSubDataFromJSON(dp[index])
            }
            
            let alert3 = new Alert()
            alert3.title = "JSON 복구에 성공했습니다."
            alert3.addAction("Done")
            await alert3.presentAlert()
            refreshEditor()
          } catch(e){
            let alert3 = new Alert()
            alert3.title = "JSON 복구에 실패했습니다."
            alert3.message = e.message
            alert3.addAction("Done")
            await alert3.presentAlert()
            refreshEditor()
          }
        }
        
      } else if(response == 4){
        let alert2 = new Alert()
        alert2.addDestructiveAction("구독 항목 모두 삭제")
        alert2.addCancelAction("Cancel")
        
        let response2 = await alert2.presentSheet()
        if(response2 != -1){
          userData.subscriptions = []
          refreshEditor()
        }
        
      } else if(response == 5){
        let alert2 = new Alert()
        alert2.addDestructiveAction("모든 데이터 삭제")
        alert2.addCancelAction("Cancel")
        
        let response2 = await alert2.presentSheet()
        if(response2 != -1){
          await fm.remove(filePath)
          Safari.open(URLScheme.forRunningScript())
          return 0
        }
        
      }
      
      refreshEditor()
    }
  }
  
  function refreshEditor(){
    editor.removeAllRows()
    loadEditor()
    editor.reload()
  }
  
  loadEditor()
  await editor.present()
  
  fm.writeString(filePath, JSON.stringify(userData))
}

// Export & Import Stage
function exportSubDataToCSV(){
  let items = JSON.parse(JSON.stringify(userData.subscriptions))
  for(index in items){
    if(items[index].tags != undefined && items[index].tags != []){
      items[index].tags.sort()
      items[index].tags = items[index].tags.join(',')
    }
    
    items[index].createdDate = items[index].identifier
    items[index].initialChargeDate = items[index].nextChargeDate
    delete items[index].nextChargeDate
    delete items[index].identifier
  }
  
  let replacer = (key, value) => value === null ? '' : value // specify how you want to handle null values here
  let header = Object.keys(items[0])
  let csv = [
    header.join(','), // header row first
    ...items.map(row => header.map(fieldName => JSON.stringify(row[fieldName], replacer)).join(','))
  ].join('\r\n')
  
  return csv
}

function exportSubDataToJSON(){
  let items = JSON.parse(JSON.stringify(userData.subscriptions))
  for(index in items){
    if(items[index].tags != undefined && items[index].tags != []){
      items[index].tags.sort()
    }
    
    items[index].createdDate = items[index].identifier
    items[index].initialChargeDate = items[index].nextChargeDate
    delete items[index].nextChargeDate
    delete items[index].identifier
  }
  
  let json = {
    "subscriptions": items,
    "tags": userData.tags,
    "categories": userData.categories,
    "exportDate": dt,
  }
  
  return JSON.stringify(json)
}

// async function importSubDataFromCSV(dataPath){}

async function importSubDataFromJSON(dataPath){
  let skipDuplicatedObject = false
  let replaceDuplicatedObject = false
  let keepDuplicatedObject = false
  let json = JSON.parse(await fm.readString(dataPath))
  
  let alert = new Alert()
  alert.title = "JSON 복원 확인"
  alert.message = getDateString("yyyy년 M월 d일 a hh:mm:ss", new Date(json.exportDate)) + "에 저장된 구독 데이터 " + json.subscriptions.length + "개를 기기에 가져올까요?"
  alert.addAction("OK")
  alert.addCancelAction("Cancel")
  
  let response = await alert.presentAlert()
  if(response == -1){
    throw new Error("Cancelled while importing stage")
  }
  
  let existingIdentifiers = []
  userData.subscriptions.forEach(i => existingIdentifiers.push(i.identifier))
  
  for(index in json.subscriptions){
    let item = json.subscriptions[index]
    if(item.createdDate == undefined || isNaN(item.createdDate)){
      item.createdDate = new Date().getTime()
    } else if(existingIdentifiers.indexOf(item.createdDate) != -1){
      if(skipDuplicatedObject){
        continue
      } else if(replaceDuplicatedObject){
        userData.subscriptions.splice(existingIdentifiers.indexOf(item.createdDate), 1)
      } else if(keepDuplicatedObject){
        item.createdDate = new Date().getTime()
      } else {
        let alert2 = new Alert()
        alert2.title = "중복 항목 존재"
        alert2.message = JSON.stringify(item) + "\n기존 데이터와 충돌하는 항목이 있습니다."
        alert2.addDestructiveAction("대치")
        alert2.addDestructiveAction("모두 대치")
        alert2.addDestructiveAction("보존")
        alert2.addDestructiveAction("모두 보존")
        alert2.addAction("건너뛰기")
        alert2.addAction("모두 건너뛰기")
        alert2.addCancelAction("Break import stage")
        
        let response2 = await alert2.presentAlert()
        if(response2 == -1){
          throw new Error("User force stopped while importing stage") 
        } else if(response2 == 0){
          userData.subscriptions.splice(existingIdentifiers.indexOf(item.createdDate), 1)
        } else if(response2 == 1){
          userData.subscriptions.splice(existingIdentifiers.indexOf(item.createdDate), 1)
          replaceDuplicatedObject = true
        } else if(response2 == 2){
          item.createdDate = new Date().getTime()
        } else if(response2 == 3){
          item.createdDate = new Date().getTime()
          keepDuplicatedObject = true
        } else if(response2 == 4){
          continue
        } else if(response2 == 5){
          continue
          skipDuplicatedObject = true
        }
      }
    }
      
    item.identifier = item.createdDate
    item.nextChargeDate = item.initialChargeDate
    delete item.createdDate
    delete item.initialChargeDate
    
    userData.subscriptions.push(item)
  }
  
  let tags = json.tags
  for(i in tags){
    if(userData.tags.indexOf(tags[i]) == -1){
      userData.tags.push(tags[i])
    }
  }
  
  let categories = json.categories
  for(i in categories){
    if(userData.categories.indexOf(categories[i]) == -1){
      userData.categories.push(categories[i])
    }
  }
}


// SUBCALAT[targetSubIdentifier]AT[targetDate]
async function pushEarlyNotification(){
  // Notification Pushing Stage
  // Watch pending state + Remove deprecated identifiers
  let allPending = await Notification.allPending()
  let pendingRemovalIdentifier = []
  for(index in allPending){
    if(allPending[index].identifier.split("AT")[0] == "SUBCAL" && !pendingNotiIdentifier.includes(allPending[index].identifier)){
      pendingRemovalIdentifier.push(allPending[index].identifier)
    }
  }
  await Notification.removePending(pendingRemovalIdentifier)
  
  // Schedule pending identifiers + update
  for(index in pendingNotifier){
    let noti = pendingNotifier[index][0]
    noti.setTriggerDate(new Date(pendingNotifier[index][1] + userData.notiDelay))
    await noti.schedule()
  }
}


// Widget stage
function buildWidget(specifiedWidgetFamily, showPreview, specifiedWidgetPreset){
  let widgetFamily = specifiedWidgetFamily ? specifiedWidgetFamily : config.widgetFamily
  let sessionPreset = specifiedWidgetPreset ? specifiedWidgetPreset : "default"
  
  // 사용자 구성 적용
  if(args.widgetParameter){
    if(Object.keys(userData.widgetPresets).indexOf(args.widgetParameter) != -1){
      sessionPreset = args.widgetParameter
    }
  }
  
  // userData에서 array 복사
  let localSubscriptions = JSON.parse(JSON.stringify(userData.subscriptions))
  
  let session = userData.widgetPresets[sessionPreset]
  
  // 구독 항목 Filter
  if(session.targetIdentifiers.length > 0){
    localSubscriptions = localSubscriptions.filter(tempObject => session.targetIdentifiers.indexOf(tempObject.identifier) != -1)
  }
  
  // 카테고리 Filter
  if(session.filterCategory != undefined){
    localSubscriptions = localSubscriptions.filter(tempObject => tempObject.category == session.filterCategory)
  }
  
  // 사용자 정의 조건 Filter
  let supportUserFilter = widgetFamily == "medium" || widgetFamily == "large"
  if(session.filterType == 1 || !supportUserFilter){
    localSubscriptions.sort(function (tempObjectA, tempObjectB){
      let temp = [0, 0, 0]
      temp[tempObjectA.cycleType] = tempObjectA.cycle
      let scRenewalA = getLatestRenewal(new Date(tempObjectA.nextChargeDate), temp)
      
      temp = [0, 0, 0]
      temp[tempObjectB.cycleType] = tempObjectB.cycle
      let scRenewalB = getLatestRenewal(new Date(tempObjectB.nextChargeDate), temp)
      
      return scRenewalA.date - scRenewalB.date
    })
  } else if(session.filterType == 2){
    localSubscriptions.sort(function (tempObjectA, tempObjectB){
      return ('' + tempObjectA.title).localeCompare(tempObjectB.title)
    })
  } else if(session.filterType == 3){
    localSubscriptions.sort(function (tempObjectA, tempObjectB){
      let tempPriceA, tempPriceB
      
      if(tempObjectA.currency == "IDR(100)" || tempObjectA.currency == "JPY(100)"){
        tempPriceA = tempObjectA.price / 100 * parseFloat(exchangeRates.data[supportedExchangeTags.indexOf(tempObjectA.currency)].deal_bas_r.replace(",", ""))
      } else {
        tempPriceA = tempObjectA.price * parseFloat(exchangeRates.data[supportedExchangeTags.indexOf(tempObjectA.currency)].deal_bas_r.replace(",", ""))
      }
      
      if(tempObjectB.currency == "IDR(100)" || tempObjectB.currency == "JPY(100)"){
        tempPriceB = tempObjectB.price / 100 * parseFloat(exchangeRates.data[supportedExchangeTags.indexOf(tempObjectB.currency)].deal_bas_r.replace(",", ""))
      } else {
        tempPriceB = tempObjectB.price * parseFloat(exchangeRates.data[supportedExchangeTags.indexOf(tempObjectB.currency)].deal_bas_r.replace(",", ""))
      }
      
      return tempPriceA - tempPriceB
    })
  }
  
  if(session.filterReversed && supportUserFilter){
    localSubscriptions = localSubscriptions.reverse()
  }
  
  // 위젯 레이아웃
  let widget = new ListWidget()
  
  if(widgetFamily == "small"){
    let baseText = widget.addText("갱신 예정")
    baseText.font = Font.boldSystemFont(20)
    baseText.textColor = new Color("ffffff")
    
    widget.addSpacer(6)
    
    let itmLength = Math.min(5, localSubscriptions.length)
    
    for(let i = 0; i < itmLength; i++){
      let subObject = localSubscriptions[i]
      /*
      let temp = [0, 0, 0]
      temp[subObject.cycleType] = subObject.cycle
      let scRenewal = getLatestRenewal(new Date(subObject.nextChargeDate), temp)
      */
      let stack = widget.addStack()
      stack.centerAlignContent()
      
      let icon = stack.addImage(SFSymbol.named("seal").image)
      icon.tintColor = new Color(session.accentColor)
      icon.imageSize = new Size(15, 15)
      
      stack.addSpacer(4)
      
      let subTitleText = stack.addText(subObject.title)
      subTitleText.font = Font.systemFont(13)
      subTitleText.textColor = new Color("dddddd")
      subTitleText.lineLimit = 1
      /*
      let subPeriodText = stack.addText(" • " + (!getDayCount(new Date(scRenewal.date)) ? "오늘" : getRelativeDateString(new Date(scRenewal.date), new Date(new Date(dt).setHours(0,0,0,0)))))
      subPeriodText.font = Font.boldMonospacedSystemFont(13)
      subPeriodText.textColor = new Color("2edab7")
      subPeriodText.lineLimit = 1
      */
      if(i != itmLength-1){ widget.addSpacer(4) }
    }
    
    widget.backgroundColor = new Color("1a1a1a")
    widget.setPadding(12,12,12,12)
    
  } else if(widgetFamily == "medium" || widgetFamily == "large"){
    let itmHCount = 2
    let itmVCount = widgetFamily == "large" ? 4 : 2
    let itmIndex = -1
    
    let itmLength = Math.min(itmHCount * itmVCount, localSubscriptions.length)
    
    let vStack = widget.addStack()
    vStack.layoutVertically()
    
    for(let i = 0; i < itmVCount; i++){
      let hStack = vStack.addStack()
      
      for(let j = 0; j < itmHCount; j++){
        itmIndex++
        
        let itmStack = hStack.addStack()
        itmStack.layoutVertically()
        
        let hSpacer = itmStack.addStack()
        hSpacer.addSpacer()
        
        if(itmIndex < itmLength){
          itmStack.cornerRadius = 15
          itmStack.backgroundColor = new Color("242424")
          itmStack.setPadding(6,9,0,9)
          
          let subObject = localSubscriptions[itmIndex]
          
          let getSubPriceString = () => {
            if(subObject.price == 0){ return "가격 미정" }
            else if(subObject.currency == "KRW"){
              return subObject.price.toLocaleString() + "원"
            } else if(subObject.currency == "IDR(100)" || subObject.currency == "JPY(100)"){
              let productRate = subObject.price / 100 * parseFloat(exchangeRates.data[supportedExchangeTags.indexOf(subObject.currency)].deal_bas_r.replace(",", ""))
              productRate = Math.round(productRate/10) * 10
              return "약 " + productRate.toLocaleString() + "원"
            } else {
              let productRate = subObject.price * parseFloat(exchangeRates.data[supportedExchangeTags.indexOf(subObject.currency)].deal_bas_r.replace(",", ""))
              productRate = Math.round(productRate/10) * 10
              return "약 " + productRate.toLocaleString() + "원"
            }
          }
          
          let temp = [0, 0, 0]
          temp[subObject.cycleType] = subObject.cycle
          let scRenewal = getLatestRenewal(new Date(subObject.nextChargeDate), temp)
          
          let detailText
          if(session.detailText == 0){
            let subCycleString = subObject.cycle + cycleTypes[subObject.cycleType].replace("마다", "")
            detailText = subCycleString + " 정기구독 · 주기 " + scRenewal.count
          } else if(session.detailText == 1){
            detailText = subObject.category == undefined ? "카테고리 없음" : subObject.category
          } else if(session.detailText == 2){
            if(subObject.tags == undefined){
              detailText = "태그 없음"
            } else if(!subObject.tags.length){
              detailText = "태그 없음"
            } else if(subObject.tags.length < 2){
              detailText = subObject.tags[0]
            } else {
              detailText = subObject.tags[0] + " 및 " + (subObject.tags.length-1) + "개"
            }
          } else if(session.detailText == 3){
            detailText = subObject.payment == undefined ? "결제 수단 없음" : subObject.payment
          }
          
          let stack1 = itmStack.addStack()
          stack1.centerAlignContent()
          
          let icon = stack1.addImage(SFSymbol.named("seal").image)
          icon.tintColor = new Color(session.accentColor)
          icon.imageSize = new Size(22, 22)
          
          stack1.addSpacer(3)
          
          let subTitleText = stack1.addText(subObject.title)
          subTitleText.font = Font.boldSystemFont(14)
          subTitleText.textColor = new Color("dddddd")
          subTitleText.lineLimit = 1
          
          itmStack.addSpacer(5)
          
          let stack2 = itmStack.addStack()
          stack2.centerAlignContent()
          
          let todayPayString = widgetFamily == "large" ? "오늘 결제" : "오늘"
          let subPeriodString = !getDayCount(new Date(scRenewal.date)) ? todayPayString : getRelativeDateString(new Date(scRenewal.date), new Date(new Date(dt).setHours(0,0,0,0)))
          
          let subPeriodText = stack2.addText(subPeriodString + (session.showPrice ? (" • " + getSubPriceString()) : ""))
          subPeriodText.font = Font.boldSystemFont(widgetFamily == "large" ? 13 : 12)
          subPeriodText.textColor = new Color(session.accentColor)
          subPeriodText.lineLimit = 1
          
          let subDetailText = itmStack.addText(detailText)
          subDetailText.font = Font.systemFont(widgetFamily == "large" ? 12 : 11)
          subDetailText.textColor = Color.lightGray()
          subDetailText.lineLimit = 1
        }
        
        itmStack.addSpacer()
        
        if(j != itmHCount - 1){ hStack.addSpacer(5) }
      }
      
      if(i != itmVCount - 1){ vStack.addSpacer(5) }
    }
    
    widget.backgroundColor = new Color("1a1a1a")
    widget.setPadding(5,5,5,5)
    
  } else if(widgetFamily == "accessoryRectangular"){
    let subObject = localSubscriptions[0]
    
    let temp = [0, 0, 0]
    temp[subObject.cycleType] = subObject.cycle
    let scRenewal = getLatestRenewal(new Date(subObject.nextChargeDate), temp)
    
    let detailText
    if(session.detailText == 0){
      let subCycleString = subObject.cycle + cycleTypes[subObject.cycleType].replace("마다", "")
      detailText = subCycleString + " · 주기 " + scRenewal.count
    } else if(session.detailText == 1){
      detailText = subObject.category == undefined ? "카테고리 없음" : subObject.category
    } else if(session.detailText == 2){
      if(subObject.tags == undefined){
        detailText = "태그 없음"
      } else if(!subObject.tags.length){
        detailText = "태그 없음"
      } else if(subObject.tags.length < 2){
        detailText = subObject.tags[0]
      } else {
        detailText = subObject.tags[0] + " 및 " + (subObject.tags.length-1) + "개"
      }
    } else if(session.detailText == 3){
      detailText = subObject.payment == undefined ? "결제 수단 없음" : subObject.payment
    }
    
    let stack1 = widget.addStack()
    stack1.centerAlignContent()
    
    let icon = stack1.addImage(SFSymbol.named("seal").image)
    icon.tintColor = new Color(session.accentColor)
    icon.imageSize = new Size(15, 15)
    
    stack1.addSpacer(3)
    
    let subTitleText = stack1.addText(subObject.title)
    subTitleText.font = Font.boldSystemFont(14)
    subTitleText.lineLimit = 1
    
    stack1.addSpacer()
    
    let subPeriodText = widget.addText(!getDayCount(new Date(scRenewal.date)) ? "오늘 결제" : getRelativeDateString(new Date(scRenewal.date), new Date(new Date(dt).setHours(0,0,0,0))))
    subPeriodText.lineLimit = 1
    
    let subDetailText = widget.addText(detailText)
    subDetailText.textOpacity = 0.7
    subDetailText.lineLimit = 1
    
  }
  
  widget.refreshAfterDate = new Date(Date.now() + 1000 * 300)
  
  if(config.runsInWidget){ Script.setWidget(widget) }
  else if(showPreview){
    if(specifiedWidgetFamily == "small"){
      widget.presentSmall()
    } else if(specifiedWidgetFamily == "medium"){
      widget.presentMedium()
    } else if(specifiedWidgetFamily == "large"){
      widget.presentLarge()
    } else if(specifiedWidgetFamily == "accessoryRectangular"){
      widget.presentAccessoryRectangular()
    }
  }
}

if(config.runsInApp){
  let qp = args.queryParameters
  if(qp.action == "addPartnerSub"){
    
  } else if(qp.action == "addNewSub"){
    await showSubConfiguratorTable()
  } else if(qp.action == "widgetPreference"){
    
    App.close()
    return 0
  }
  await showSubListViewTable()
  await pushEarlyNotification()
  
} else if(config.runsInWidget){
  
  if(config.widgetFamily != "accessoryRectangular"){
    // Notification stage for widget
    for(index in userData.subscriptions){
      let subObject = userData.subscriptions[index]
      let temp = [0, 0, 0]
      temp[subObject.cycleType] = subObject.cycle
      let scRenewal = getLatestRenewal(new Date(subObject.nextChargeDate), temp)
      
      let scNotifier = getAvailableNotifier(scRenewal.date, subObject.identifier)
      fetchEarlyNotification(scNotifier, scRenewal.date, subObject.identifier)
    }
    
    await pushEarlyNotification()
  }
  
  // Sub Calendar Widget stage
  buildWidget()
}
