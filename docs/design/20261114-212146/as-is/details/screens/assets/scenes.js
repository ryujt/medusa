/*
 * 장면 전환 스크립트 (검토용, 실제 API 동작 아님)
 * - <body data-scenes="id:이름|id:이름"> 첫 항목이 기본 장면이다.
 * - data-scene="a b"  : 나열한 장면에서만 보인다.
 * - data-not-scene="a b" : 나열한 장면에서 숨긴다.
 * - data-goto="scene-id" : 클릭하면 같은 페이지의 해당 장면으로 바꾼다(실제 제품 동작을 흉내 낸 예시).
 * - URL fragment(#scene-id)로 직접 열면 해당 장면을 표시한다.
 */
(function () {
  var body = document.body
  var defs = (body.getAttribute("data-scenes") || "")
    .split("|")
    .filter(Boolean)
    .map(function (s) {
      var i = s.indexOf(":")
      return { id: s.slice(0, i), name: s.slice(i + 1) }
    })
  var ids = defs.map(function (d) { return d.id })

  var bar = document.createElement("div")
  bar.className = "review-bar"
  bar.innerHTML = "<b>검토용 장면 선택</b>"
  defs.forEach(function (d) {
    var a = document.createElement("a")
    a.href = "#" + d.id
    a.textContent = d.name
    a.setAttribute("data-id", d.id)
    bar.appendChild(a)
  })
  var note = body.getAttribute("data-note")
  if (note) {
    var n = document.createElement("details")
    n.className = "note"
    var sum = document.createElement("summary")
    sum.textContent = "근거·미확인 메모"
    var p = document.createElement("div")
    p.textContent = note
    n.appendChild(sum)
    n.appendChild(p)
    bar.appendChild(n)
  }
  body.insertBefore(bar, body.firstChild)

  function syncBarHeight() {
    document.documentElement.style.setProperty("--rb", bar.offsetHeight + "px")
  }
  syncBarHeight()
  window.addEventListener("resize", syncBarHeight)
  bar.addEventListener("toggle", syncBarHeight, true)

  function show(id) {
    if (ids.indexOf(id) < 0) id = ids[0]
    document.querySelectorAll("[data-scene]").forEach(function (el) {
      var list = el.getAttribute("data-scene").split(/\s+/)
      el.classList.toggle("scene-on", list.indexOf(id) >= 0)
    })
    document.querySelectorAll("[data-not-scene]").forEach(function (el) {
      var list = el.getAttribute("data-not-scene").split(/\s+/)
      el.classList.toggle("scene-off", list.indexOf(id) >= 0)
    })
    bar.querySelectorAll("a").forEach(function (a) {
      a.classList.toggle("on", a.getAttribute("data-id") === id)
    })
    var def = defs.filter(function (d) { return d.id === id })[0]
    if (def) document.title = document.title.split(" · ")[0] + " · " + def.name
  }

  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-goto]")
    if (!t) return
    e.preventDefault()
    location.hash = t.getAttribute("data-goto")
  })
  window.addEventListener("hashchange", function () { show(location.hash.slice(1)) })
  // #scene-id 가 기본이며, fragment 를 넘길 수 없는 환경을 위해 ?scene=scene-id 도 받는다
  var q = new URLSearchParams(location.search).get("scene")
  show(location.hash.slice(1) || q || "")
})()
