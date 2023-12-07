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
			let progress_dialogue = document.getElementById('progress-dialogue')
			let progress_bar = document.createElement('progress')
			progress_bar.id = 'progress-bar'
			let progress_text = document.createElement('div')
			progress_text.innerHTML = 'Uploading...'
			progress_dialogue.innerHTML = 'Uploading...'
			progress_dialogue.appendChild(progress_bar)
			progress_dialogue.appendChild(progress_text)
			progress_dialogue.showModal()
			let Reader = new FileReader();
			Reader.readAsDataURL(file);
			let uploadedBytes = 0;
			let chunkSize = 1024 * 1024 * 2; // 2MB
			Reader.onload = () => {
				const chunk = file.slice(uploadedBytes, uploadedBytes + chunkSize);
				uploadedBytes += chunkSize;
				let done = uploadedBytes >= file.size;
				fetch('/upload', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/octet-stream',
						'Content-Disposition': `attachment; filename="${name}"`,
						'Content-Name': name,
						'Content-Range': `bytes ${uploadedBytes - chunkSize}-${uploadedBytes}/${file.size}`,
						'Content-Length': chunkSize,
						'Content-Done': done,
					},
					body: chunk,
				}).then(() => {
					const progress = Math.round((uploadedBytes / file.size) * 100);
					progress_text.innerHTML = `Uploading... ${progress}%`;
					document.getElementById('progress-bar').max = 100;
					document.getElementById('progress-bar').value = progress;

					if (!done) {
						Reader.onload(); // Continue uploading next chunk
					} else {
						progress_dialogue.innerHTML = 'Upload complete!';
						progress_dialogue.addEventListener('click', () => {
							progress_dialogue.close();
							reload();
						});
					}
				});
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

					let progress_dialogue = document.getElementById('progress-dialogue')
					progress_dialogue.innerHTML = ''
					let progress_text = document.createElement('div')
					progress_text.innerHTML = 'Downloading...'
					let progress_status = document.createElement('div')
					progress_status.innerHTML = `${item.name} 0%`
					progress_dialogue.appendChild(progress_text)
					progress_dialogue.appendChild(progressDiv)
					progress_dialogue.appendChild(progress_status)

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
						progress_status.innerHTML = `${item.name} ${Math.round((downloadedSize / totalSize) * 100)}%`;
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
	progress_dialogue.id = 'progress-dialogue'
	document.body.appendChild(progress_dialogue)
	reload()
}
