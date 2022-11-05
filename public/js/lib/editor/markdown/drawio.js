
var drawio = {}

drawio.processMarkers = function (from, to) {
  var _this = this
  var found = null
  var foundStart = 0
  var cm = window.editor
  cm.doc.getAllMarks().forEach(mk => {
    if (mk.__kind) {
      mk.clear()
    }
  })
  cm.eachLine(from, to, function (ln) {
    const line = ln.lineNo()

    if (ln.text.startsWith('```drawio')) {
      found = 'drawio'
      foundStart = line
    } else if (ln.text === '```' && found) {
      switch (found) {
        // -> DRAWIO
        case 'drawio': {
          if (line - foundStart !== 2) {
            return
          }
          _this.addMarker({
            kind: 'drawio',
            from: { line: foundStart, ch: 3 },
            to: { line: foundStart, ch: 10 },
            text: 'drawio',
            action: (function (start, end) {
              return function (ev) {
                cm.doc.setSelection({ line: start, ch: 0 }, { line: end, ch: 3 })
                try {
                  // save state data
                  const raw = cm.doc.getLine(end - 1)
                  window.sessionStorage.setItem('drawio', raw)
                  _this.show()
                } catch (err) {
                  console.log(err)
                }
              }
            })(foundStart, line)
          })

          if (ln.height > 0) {
            cm.foldCode(foundStart)
          }
          break
        }
      }
      found = null
    }
  })
}

drawio.addMarker = function ({ kind, from, to, text, action }) {
  const markerElm = document.createElement('span')
  markerElm.appendChild(document.createTextNode(text))
  markerElm.className = 'CodeMirror-buttonmarker'
  markerElm.addEventListener('click', action)

  const cm = window.editor
  cm.markText(from, to, { replacedWith: markerElm, __kind: kind })
}

drawio.show = function () {
  var _this = drawio

  const drawUrl = 'https://embed.diagrams.net/?embed=1&libraries=1&proto=json&spin=1&saveAndExit=1&noSaveBtn=1&noExitBtn=0'
  _this.div = document.createElement('div')
  _this.div.id = 'drawio'
  _this.div.innerHTML = ''
  _this.iframe = document.createElement('iframe')
  _this.iframe.setAttribute('frameborder', '0')
  _this.iframe.style.zIndex = 9999
  _this.iframe.style.width = '100%'
  _this.iframe.style.height = '100%'
  _this.iframe.style.position = 'absolute'
  _this.iframe.style.top = window.scrollY + 'px'
  _this.binded = _this.postMessage.bind(_this)
  window.addEventListener('message', _this.binded, false)
  _this.iframe.setAttribute('src', drawUrl)
  document.body.appendChild(_this.iframe)
}

drawio.postMessage = function (evt) {
  var _this = drawio

  if (evt.data.length < 1) return
  var msg = JSON.parse(evt.data)
  // const svg = ''

  switch (msg.event) {
    case 'configure':
      this.iframe.contentWindow.postMessage(
        JSON.stringify({
          action: 'configure',
          config: {
            defaultFonts: ['Humor Sans', 'Helvetica', 'Times New Roman']
          }
        }),
        '*'
      )
      break
    case 'init':
      const data = window.sessionStorage.getItem('drawio')
      const svg = Buffer.from(data, 'base64').toString()
      this.iframe.contentWindow.postMessage(
        JSON.stringify({ action: 'load', autosave: 0, xml: svg }),
        '*'
      )
      break
    case 'save':
      this.iframe.contentWindow.postMessage(
        JSON.stringify({
          action: 'export',
          format: 'xmlsvg',
          xml: msg.xml,
          spin: 'Updating page'
        }),
        '*'
      )
      break
    case 'export':
      const svgDataStart = msg.data.indexOf('base64,') + 7
      const svgData = msg.data.slice(svgDataStart)

      // clean event bind
      window.removeEventListener('message', _this.binded)
      document.body.removeChild(_this.iframe)

      // write back svg data
      var cm = window.editor
      cm.doc.replaceSelection('```drawio\n' + svgData + '\n```', 'start')
      // clean state data
      window.sessionStorage.setItem('drawio', '')
      break
    case 'exit':
      window.removeEventListener('message', _this.binded)
      document.body.removeChild(_this.iframe)
      break
  }
}

export { drawio }
