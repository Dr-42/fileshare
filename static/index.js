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
			data.files.forEach(item => {
				let li = document.createElement('li')
				li.innerHTML = item.name
				list.appendChild(li)
				let download = document.createElement('button')
				download.innerHTML = 'Download'
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
				li.appendChild(download)
				let remove = document.createElement('button')
				remove.innerHTML = 'Remove'
				remove.onclick = () => {
					let name = item.name
					let new_name = name.replace(' ', '%20');
					fetch(`/remove?name=${name}`, { method: 'POST' })
						.then(() => {
							reload()
						})
				}
				li.appendChild(remove)
			})
		})
}

window.onload = () => {
	reload()
}
