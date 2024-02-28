import { App, FuzzySuggestModal, Modal, Notice, Plugin, PluginSettingTab, SearchComponent, setIcon, Setting, TFile, WorkspaceLeaf} from 'obsidian';

interface ComicPluginSettings {
	chapters: string[];
	updateSchedule: number;
	comicTitle: string;
	episodeFolder: string;
	characterFolder: string;
	plotFolder: string;
}

const DEFAULT_SETTINGS: ComicPluginSettings = {
	chapters: [],
	updateSchedule: 14,
	comicTitle: 'My comic',
	episodeFolder: 'publishing/episodes',
	characterFolder: 'characters',
	plotFolder: 'plot'
}

export default class ComicPlugin extends Plugin {
	settings: ComicPluginSettings;

	async onload() {
		await this.loadSettings();

		// prev event
		this.addCommand({
			id: 'connect-prev-event',
			name: 'Connect previous event',
			checkCallback: (checking: boolean) => {
				if (this.app.workspace.getActiveFile()?.path.includes(this.settings.plotFolder)) {
					if (!checking) {
						new PrevEventModal(this.app, this, this.addPrevEvent).open();
					}
					return true
				}
				return false;
			},
		});

		// next event
		this.addCommand({
			id: 'connect-next-event',
			name: 'Connect next event',
			checkCallback: (checking: boolean) => {
				if (this.app.workspace.getActiveFile()?.path.includes(this.settings.plotFolder)) {
					if (!checking) {
						new NextEventModal(this.app, this, this.addNextEvent).open();
					}
					return true
				}
				return false;
			},
		});

		// file explorer
		this.app.workspace.onLayoutReady(() => {
			const explorers = this.getFileExplorers();
			explorers.forEach((exp) => {
				this.manipulateFileExplorerButtons(exp);
			});
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new ComicSettingTab(this.app, this));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	// get file explorers
	getFileExplorers(): WorkspaceLeaf[] {
		return this.app.workspace.getLeavesOfType('file-explorer');
	}

	manipulateFileExplorerButtons(exp: WorkspaceLeaf): void {
		const con = exp.view.containerEl as HTMLDivElement;
		const container = con.querySelector('div.nav-buttons-container') as HTMLDivElement;
		if (!container || container.classList.contains('comic-helper-changed')) return;
		
		// remove new file, new folder, and sort order
		let removeBtns = [
			container.querySelector('[aria-label="New note"]') as HTMLDivElement,
			container.querySelector('[aria-label="New folder"]') as HTMLDivElement,
			container.querySelector('[aria-label="Change sort order"]') as HTMLDivElement
		];
		removeBtns.forEach(btn => {
			// console.log(btn);
			if(btn) container.removeChild(btn);
		});

		// add new episode button
		let newEpisodeBtn = createEl('div');
		setIcon(newEpisodeBtn, 'list-plus');
		newEpisodeBtn.className = 'clickable-icon nav-action-button new-episode-button';
		newEpisodeBtn.setAttribute('aria-label', 'New episode');
		this.registerDomEvent(newEpisodeBtn, 'click', () => {
			new NewEpisodeModal(this.app, this, async (title: string, no: number, chapter: number, date: string, pages: number, status: string, transcript: string) => {
				let newEpisode = this.app.vault.create(`${this.settings.episodeFolder}/${title}.md`,
`---
no: ${no}
chapter: ${chapter}
date: ${date}
pages: ${pages}
status: ${status}
---
${transcript}`);
				this.app.workspace.getLeaf().openFile(await newEpisode);
			}).open();
		});
		container.insertBefore(newEpisodeBtn, container.firstChild);

		// add prev event button
		let prevEventBtn = createEl('div');
		setIcon(prevEventBtn, 'corner-down-left');
		prevEventBtn.className = 'clickable-icon nav-action-button prev-event-button';
		prevEventBtn.setAttribute('aria-label', 'Connect previous event');
		this.registerDomEvent(prevEventBtn, 'click', () => {
			if(this.app.workspace.getActiveFile()?.path.includes(this.settings.plotFolder)) {
				new PrevEventModal(this.app, this, this.addPrevEvent).open();
			} else {
				new Notice('only create plot links for EVENTS, stupid!');
			}
		});
		container.insertBefore(prevEventBtn, container.lastChild);

		// add next event button
		let nextEventBtn = createEl('div');
		setIcon(nextEventBtn, 'corner-up-right');
		nextEventBtn.className = 'clickable-icon nav-action-button next-event-button';
		nextEventBtn.setAttribute('aria-label', 'Connect next event');
		this.registerDomEvent(nextEventBtn, 'click', () => {
			if(this.app.workspace.getActiveFile()?.path.includes(this.settings.plotFolder)) {
				new NextEventModal(this.app, this, this.addNextEvent).open();
			} else {
				new Notice('only create plot links for EVENTS, stupid!');
			}
		});
		container.insertBefore(nextEventBtn, container.lastChild);

		// add new character button
		let newChBtn = createEl('div');
		setIcon(newChBtn, 'user-plus');
		newChBtn.className = 'clickable-icon nav-action-button new-ch-button';
		newChBtn.setAttribute('aria-label', 'New character');
		this.registerDomEvent(newChBtn, 'click', () => {
			new NewCharacterModal(this.app, this, async (name: string, gender: string, color: string, location: string, weapon: string) => {
				let newCharacter = this.app.vault.create(`${this.settings.characterFolder}/${name}.md`,
`---
gender: ${gender}
location: ${location}
weapon: ${weapon}
---
\`\`\`palette
${color}
#2e2e2e
{"aliases": ["accent", "hair"]}
\`\`\`

## aura

## good traits

## controversial traits

## bad traits

## quirks

## history

## relationships`);
				this.app.workspace.getLeaf().openFile(await newCharacter);
			}).open();
		});
		container.insertBefore(newChBtn, container.lastChild);
		container.classList.add('comic-helper-changed');
	}

	addPrevEvent(file: TFile) {
		this.app.vault.append(file, `\n\nnext: [[${this.app.workspace.getActiveFile()?.basename}]]`);
		new Notice(`added link from "${file.basename}" to "${this.app.workspace.getActiveFile()?.basename}".`);
	}

	addNextEvent(file: TFile) {
		if(!this.app.workspace.getActiveFile()) {
			new Notice('oops, current file does not exist');
			return;
		}
		this.app.vault.append(this.app.workspace.getActiveFile() as TFile, `\n\nnext: [[${file.basename}]]`);
		new Notice(`added link from "${this.app.workspace.getActiveFile()?.basename}" to "${file.basename}"`)
	}
}

class ComicSettingTab extends PluginSettingTab {
	plugin: ComicPlugin;

	constructor(app: App, plugin: ComicPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();
		// name
		new Setting(containerEl)
			.setName('comic name')
			.addText(text => {
				text.setValue(this.plugin.settings.comicTitle)
					.onChange(async (value) => {
						this.plugin.settings.comicTitle = value;
						await this.plugin.saveSettings();
					})
			});
		// update schedule
		new Setting(containerEl)
			.setName('update schedule')
			.addText(text => {
				text.setPlaceholder('14')
					.setValue(this.plugin.settings.updateSchedule.toString())
					.onChange(async value => {
						this.plugin.settings.updateSchedule = parseInt(value);
						await this.plugin.saveSettings();
					});
			});
		// episode folder
		new Setting(containerEl)
			.setName('episodes folder')
			.setDesc('where should new episode notes be created?')
			.addText(text => {
				text.setPlaceholder('publishing/episodes')
					.setValue(this.plugin.settings.episodeFolder)
					.onChange(async value => {
						this.plugin.settings.episodeFolder = value;
						await this.plugin.saveSettings();
					})
			});
		// episode folder
		new Setting(containerEl)
			.setName('character folder')
			.setDesc('where should new character notes be created?')
			.addText(text => {
				text.setPlaceholder('characters')
					.setValue(this.plugin.settings.characterFolder)
					.onChange(async value => {
						this.plugin.settings.characterFolder = value;
						await this.plugin.saveSettings();
					})
			});
		// episode folder
		new Setting(containerEl)
			.setName('plot folder')
			.setDesc('where should new plot notes be created?')
			.addText(text => {
				text.setPlaceholder('plot')
					.setValue(this.plugin.settings.plotFolder)
					.onChange(async value => {
						this.plugin.settings.plotFolder = value;
						await this.plugin.saveSettings();
					})
			});
	}
}

class NewEpisodeModal extends Modal {
	plugin: ComicPlugin;
	title: string;
	no: number;
	chapter: number;
	date: string;
	pages: number;
	status: string;
	transcript: string;
	onSubmit: (title: string, no: number, chapter: number, date: string, pages: number, status: string, transcript: string) => void;
	months: number[] = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

	constructor(app: App, plugin: ComicPlugin, onSubmit: (title: string, no: number, chapter: number, date: string, pages: number, status: string, transcript: string) => void) {
		super(app);
		this.plugin = plugin;
		this.onSubmit = onSubmit;
		// console.log('HEYHEYHEY', this.plugin);
	}
	onOpen() {
		const files = this.app.vault.getMarkdownFiles().filter(file => file.path.includes('publishing/episodes'));
		let largestIdx = 0;
		let lastEpisode = files[0];
		for(let z = 0; z < files.length; z++) {
			// console.log(this.app.metadataCache.getFileCache(files[z])?.frontmatter);
			let no = this.app.metadataCache.getFileCache(files[z])?.frontmatter?.no;
			if(no > largestIdx) {
				largestIdx = no;
				lastEpisode = files[z];
			}
		}
		const frontmatter = this.app.metadataCache.getFileCache(lastEpisode)?.frontmatter;
		// console.log(lastEpisode);
		const {contentEl} = this;
		contentEl.createEl('h1', {text: `New Episode for ${this.plugin.settings.comicTitle}`});
		// title
		new Setting(contentEl)
			.setName('title')
			.addText(text => {
				text.onChange(value => {
					this.title = value;
				})
			});
		// no
		new Setting(contentEl)
			.setName('no')
			.addText(text => {
				text.setValue((largestIdx + 1).toString())
					.onChange(value => {
						this.no = parseInt(value);
					})
				this.no = parseInt(text.getValue());
			});
		// chapter
		new Setting(contentEl)
			.setName('chapter')
			.addText(text => {
				text.setValue(frontmatter?.chapter.toString())
					.onChange(value => {
						this.chapter = parseInt(value);
					});
				this.chapter = parseInt(text.getValue());
			});
		// date
		new Setting(contentEl)
			.setName('date')
			.addText(text => {
				text.setValue(this.increaseDate(
						frontmatter?.date,
						this.plugin.settings.updateSchedule))
					.onChange(value => {
						this.date = value;
					});
				this.date = text.getValue();
			});
		// pages
		new Setting(contentEl)
			.setName('pages')
			.addSlider(sld => {
				sld.setLimits(2, 5, 1)
					.setDynamicTooltip()
					.setValue(3)
					.onChange(value => {
						this.pages = value;
					})
					.showTooltip();
				this.pages = sld.getValue();
			});
		// status
		new Setting(contentEl)
			.setName('status')
			.addDropdown(dpdn => {
				dpdn.addOption('sketched', 'Sketched')
					.addOption('buffer', 'Buffer')
					.addOption('published', 'Published')
					.setValue('sketched');
				this.status = dpdn.getValue();
			});
		// transcript
		new Setting(contentEl)
			.setName('transcript')
			.addTextArea(ta => {
				ta.setValue('')
					.onChange(value => {
						this.transcript = value;
					});
			});
		// submit
		new Setting(contentEl)
			.addButton(btn => {
				btn.setIcon('check')
					.setCta()
					.onClick(() => {
						if(this.title == undefined) {
							new Notice('enter title');
							return;
						}
						this.close();
						this.onSubmit(this.title, this.no, this.chapter, this.date, this.pages, this.status, this.transcript || '');
					})
			});
	}
	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
	increaseDate(date: string, add: number) {
		let day = parseInt(date.slice(8, 10));
		let strMonth = date.slice(5, 7);
		let month = parseInt(strMonth);
		let year = parseInt(date.slice(0, 4));
		// console.log(day, month);
		day += add;
		let daysInMonth = this.months[month];
		if(month == 2 && this.isLeap(year)) daysInMonth = 29;
		if(day > daysInMonth) {
			day -= daysInMonth;
			month++;
			if(month > 12) {
				month = 1;
				year++;
			}
			strMonth = month.toString();
			if(strMonth.length == 1) strMonth = '0' + strMonth;
		}
		let strDay = day.toString();
		if(strDay.length == 1) strDay = '0' + strDay;
		return [year, month, strDay].join('-');
	}
	isLeap(year: number) {
		return (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? true : false;
	}
}

class PrevEventModal extends FuzzySuggestModal<TFile> {
	plugin: ComicPlugin;
	currentFile: TFile;
	onSubmit: (file: TFile) => void;

	constructor(app: App, plugin: ComicPlugin, onSubmit: (file: TFile) => void) {
		super(app);
		this.plugin = plugin;
		this.onSubmit = onSubmit;
		this.setPlaceholder('Select the previous event');
	}

	getItems(): TFile[] {
		return this.app.vault.getFiles().filter(file => file.path.includes(this.plugin.settings.plotFolder));
	}

	getItemText(file: TFile): string {
		return file.basename;
	}

	onChooseItem(file: TFile, evt: MouseEvent | KeyboardEvent) {
		this.onSubmit(file);
	}
}

export class NextEventModal extends FuzzySuggestModal<TFile> {
	plugin: ComicPlugin;
	currentFile: TFile;
	onSubmit: (file: TFile) => void;

	constructor(app: App, plugin: ComicPlugin, onSubmit: (file: TFile) => void) {
		super(app);
		this.plugin = plugin;
		this.onSubmit = onSubmit;
		this.setPlaceholder('Select the next event');
	}

	getItems(): TFile[] {
		return this.app.vault.getFiles().filter(file => file.path.includes(this.plugin.settings.plotFolder));
	}

	getItemText(file: TFile): string {
		return file.basename;
	}

	onChooseItem(file: TFile, evt: MouseEvent | KeyboardEvent) {
		this.onSubmit(file);
	}
}

class NewCharacterModal extends Modal {
	plugin: ComicPlugin;
	name: string;
	gender: string;
	color: string;
	location: string;
	weapon: string;
	onSubmit: (name: string, gender: string, color: string, location: string, weapon: string) => void;

	constructor(app: App, plugin: ComicPlugin, onSubmit: (name: string, gender: string, color: string, location: string, weapon: string) => void) {
		super(app);
		this.plugin = plugin;
		this.onSubmit = onSubmit;
	}
	onOpen() {
		const {contentEl} = this;
		contentEl.createEl('h1', {text: `New Character for ${this.plugin.settings.comicTitle}`});
		new Setting(contentEl)
			.setName('name')
			.addText(text => {
				text.onChange(value => {
					this.name = value;
				})
			});
		new Setting(contentEl)
			.setName('gender')
			.addDropdown(dpdn => {
				dpdn.addOption('♀', '♀')
					.addOption('♂', '♂')
					.setValue('/')
					.onChange(value => {
						this.gender = value;
					});
			});
		new Setting(contentEl)
			.setName('color')
			.addColorPicker(cp => {
				this.color = '#000000';
				cp.onChange(value => {
					this.color = value;
				});
			});
		new Setting(contentEl)
			.setName('location')
			.addText(text => {
				text.onChange(value => {
					this.location = value;
				})
			});
		new Setting(contentEl)
			.setName('weapon')
			.addText(text => {
				text.onChange(value => {
					this.weapon = value;
				})
			});
		new Setting(contentEl)
			.addButton(btn => {
				btn.setIcon('check')
					.setCta()
					.onClick(() => {
						if(this.name && this.gender && this.color && this.location && this.weapon) {
							this.close();
							this.onSubmit(this.name, this.gender, this.color, this.location, this.weapon);
						} else {
							new Notice('there are unentered fields');
							return;
						}
					})
			})
	}
	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}