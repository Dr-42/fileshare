async function reload() {
	fetch('/list')
		.then(async serdata => {
			let data = await serdata.json()
			let list = document.getElementById('main-content')
			list.innerHTML = ''
			let upload = document.createElement('input')
			upload.type = 'file'
			upload.onchange = () => {
				let file = upload.files[0];
				let name = file.name;
				let Reader = new FileReader();
				Reader.readAsDataURL(file);
				Reader.onload = () => {
					let data = {
						name: name,
						data: Reader.result
					}
					let json_data = JSON.stringify(data)
					fetch('/upload', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: json_data
					}).then(() => {
						reload()
					})
				}
			}
			list.appendChild(upload)
			console.log(data)
			let content = document.createElement('div')
			content.className = 'holder'
			data.files.forEach(item => {
				let li = document.createElement('div')
				li.className = 'item'
				let name_div = document.createElement('div')
				name_div.className = 'name'
				name_div.innerHTML = item.name
				li.appendChild(name_div)
				content.appendChild(li)
				let download = document.createElement('button')
				let download_div = document.createElement('div')
				download_div.className = 'download'
				download.innerHTML = '⇓'
				download.onclick = () => {
					let name = item.name
					let new_name = name.replace(' ', '%20');
					fetch(`/file?name=${new_name}`)
						.then(res => res.blob())
						.then(blob => {
							let a = document.createElement('a')
							a.href = URL.createObjectURL(blob)
							a.download = item.name
							a.click()
						})
				}
				download_div.appendChild(download)
				li.appendChild(download_div)
				let remove = document.createElement('button')
				let remove_div = document.createElement('div')
				remove_div.className = 'remove'
				remove.innerHTML = '⨯'
				remove.onclick = () => {
					let name = item.name
					let new_name = name.replace(' ', '%20');
					fetch(`/remove?name=${new_name}`, { method: 'POST' })
						.then(() => {
							reload()
						})
				}
				remove_div.appendChild(remove)
				li.appendChild(remove_div)
			})
			list.appendChild(content)
		})
}

window.onload = () => {
	reload()
}
