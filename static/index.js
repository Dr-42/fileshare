async function reload() {
	fetch('/list').then(async serdata => {
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
			let download = document.createElement('button');
			let download_div = document.createElement('div');
			download_div.className = 'download';
			download.innerHTML = '⇓';

			download.onclick = () => {
				let name = item.name;
				let new_name = name.replace(' ', '%20');

				fetch(`/file?name=${new_name}`).then(res => {
					const totalSize = parseInt(res.headers.get('content-length'));
					let downloadedSize = 0;

					const progressBar = document.createElement('progress');
					progressBar.max = totalSize;
					progressBar.value = 0;

					const progressDiv = document.createElement('div');
					progressDiv.appendChild(progressBar);

					let progress_dialogue = document.getElementById('progress_dialogue')
					progress_dialogue.innerHTML = ''
					progress_dialogue.appendChild(progressDiv)

					progress_dialogue.showModal();
					let reader = res.body.getReader();
					let data = null;
					reader.read().then(function processResult({ done, value }) {
						if (done) {
							// console.log('Download complete');
							// Download the data
							let a = document.createElement('a');
							a.href = URL.createObjectURL(new Blob([data, value]));
							a.download = name;
							a.click();
							progress_dialogue.innerHTML = 'Download complete!';
							progress_dialogue.addEventListener('click', () => {
								progress_dialogue.close();
							});
							return;
						}

						downloadedSize += value.byteLength;
						progressBar.value = downloadedSize;
						if (data === null) {
							data = new Blob([value]);
						} else {
							data = new Blob([data, value]);
						}
						reader.read().then(processResult);
					});
				});
			};

			download_div.appendChild(download);
			li.appendChild(download_div);
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
	let progress_dialogue = document.createElement('dialog')
	progress_dialogue.id = 'progress_dialogue'
	document.body.appendChild(progress_dialogue)
	reload()
}
