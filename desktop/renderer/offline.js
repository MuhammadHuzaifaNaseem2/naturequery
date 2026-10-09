'use strict'
document.getElementById('retry').onclick = async () => {
  document.getElementById('retry').disabled = true
  document.getElementById('status').textContent = 'Connecting…'
  await window.naturequery.app.openWorkspace()
}
document.getElementById('home').onclick = () => window.naturequery.app.home()
