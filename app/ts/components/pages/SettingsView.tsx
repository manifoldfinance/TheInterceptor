
import { sendPopupMessageToBackgroundPage } from '../../background/backgroundUtils.js'
import { SettingsParam } from '../../utils/user-interface-types.js'
import { ExternalPopupMessage, ImportSettingsReply } from '../../utils/interceptor-messages.js'
import { useEffect, useState } from 'preact/hooks' 
import { Error as ErrorComponent} from '../subcomponents/Error.js'
import { DinoSays } from '../subcomponents/DinoSays.js'

type CheckBoxSettingParam = {
	text: string
	checked: boolean
	onInput: (checked: boolean) => void
}

function CheckBoxSetting(param: CheckBoxSettingParam) {
	return (
		<div class = 'container'>
			<label class = 'form-control' style = { `color: var(--text-color); font-size: 1em;` }>
				<input type = 'checkbox'
					checked = { param.checked }
					onInput = { e => { if (e.target instanceof HTMLInputElement && e.target !== null) { param.onInput(e.target.checked) } } }
				/>
				<p class = 'paragraph checkbox-text' style = { `color: var(--text-color);` }> { param.text } </p>
			</label>
		</div>
	)
}

function ImportExport() {
	const [settingsReply, setSettingsReply] = useState<ImportSettingsReply | undefined>(undefined)

	useEffect(() => {
		async function popupMessageListener(msg: unknown) {
			const message = ExternalPopupMessage.parse(msg)
			if (message.method === 'popup_initiate_export_settings_reply') return setSettingsReply(message)
			if (message.method !== 'popup_initiate_export_settings') return
			downloadFile('interceptorSettingsAndAddressbook.json', message.data.fileContents)
		}
		browser.runtime.onMessage.addListener(popupMessageListener)

		return () => browser.runtime.onMessage.removeListener(popupMessageListener)
	})

	const downloadFile = function (filename: string, fileContents: string) {
		window.URL = window.webkitURL || window.URL
		const blobData = new Blob([fileContents], { type: 'text/json; charset = utf-8' })
		const a = document.createElement('a')
		a.href = window.URL.createObjectURL(blobData)
		a.download = filename
		a.style.display = 'none'
		document.body.appendChild(a)
		a.click()
		document.body.removeChild(a)
	}

	const importSettings = async (inputElement: { target: EventTarget | EventTarget & { files: FileList } | null }) => {
		if (inputElement.target === null) return
		if (!('files' in inputElement.target)) throw new Error('Did not select one file.')
		if (inputElement.target.files.length !== 1) throw new Error('Did not select one file.')
		const reader = new FileReader()
		reader.readAsText(inputElement.target.files[0])
		reader.onloadend = async function() {
			if (reader.result === null) throw new Error('failed to load file')
			await sendPopupMessageToBackgroundPage({ method: 'popup_import_settings', data: { fileContents: reader.result as string } })
		}
		reader.onerror = function() {
			console.error(reader.error)
			throw new Error('error on importing settings')
		}
	}
	const exportSettings = async () => await sendPopupMessageToBackgroundPage({ method: 'popup_get_export_settings' })
	return <>
		{ settingsReply !== undefined && settingsReply.data.success === false ?
			<div style = 'margin: 10px; background-color: var(--bg-color);'>
				<ErrorComponent warning = { true } text = { settingsReply.data.errorMessage }/>
			</div>
		: <></> }
		{ settingsReply !== undefined && settingsReply.data.success === true ?
			<div style = 'margin: 10px; background-color: var(--bg-color);'>
				<DinoSays text = { 'Settings and address book loaded!' }/>
			</div>
		: <></> }
		<div class = 'popup-button-row'>
			<div style = 'display: flex; flex-direction: row;'>
				<label className = 'button is-primary is-danger' style = 'flex-grow: 1; margin-left: 5px; margin-right: 5px;'>
					Import settings
					<input type = 'file' accept = '.json' onInput = { importSettings } style = 'position: absolute; width: 100%; height: 100%; opacity: 0;'/>
				</label>
				<button className = 'button is-primary' style = 'flex-grow: 1; margin-left: 5px; margin-right: 5px;' onClick = { exportSettings }>
					Export settings
				</button>
			</div>
		</div>
	</>
}

export function SettingsView(param: SettingsParam) {
	function goHome() {
		param.setAndSaveAppPage('Home')
	}

	async function setUseTabsInsteadOfPopups(checked: boolean) {
		await sendPopupMessageToBackgroundPage({
			method: 'popup_ChangeSettings',
			data: {
				useTabsInsteadOfPopup: checked
			}
		})
	}
	
	return ( <>
		<div class = 'modal-background'> </div>
		<div class = 'modal-card' style = 'height: 100%;'>
			<header class = 'modal-card-head card-header interceptor-modal-head window-header'>
				<div class = 'card-header-icon unset-cursor'>
					<span class = 'icon'>
						<img src = '../img/settings.svg'/>
					</span>
				</div>
				<p class = 'card-header-title'>
					<p className = 'paragraph'>
					Settings
					</p>
				</p>
				<button class = 'card-header-icon' aria-label = 'close' onClick = { goHome }>
					<span class = 'icon' style = 'color: var(--text-color);'> X </span>
				</button>
			</header>
			<section class = 'modal-card-body'>
				<ul>
					<li>
						<CheckBoxSetting
							text = { 'Open popups as tabs (experimental)' }
							checked = { param.useTabsInsteadOfPopup === true }
							onInput = { setUseTabsInsteadOfPopups }
						/>
					</li>
					<li>
						<ImportExport/>
					</li>
				</ul>
			</section>
			<footer class = 'modal-card-foot window-footer' style = 'border-bottom-left-radius: unset; border-bottom-right-radius: unset; border-top: unset; padding: 10px;'>
				<button class = 'button is-primary is-success' onClick = { goHome }> Close </button>
			</footer>
		</div>
	</> )
}
