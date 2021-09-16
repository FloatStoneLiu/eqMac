import {
  Component,
  OnInit,
  ViewChild,
  AfterContentInit
} from '@angular/core'
import { UtilitiesService } from './services/utilities.service'
import { UIService } from './services/ui.service'
import { FadeInOutAnimation, FromTopAnimation } from '@eqmac/components'
import { MatDialog, MatDialogRef } from '@angular/material/dialog'
import { TransitionService } from './services/transitions.service'
import { AnalyticsService } from './services/analytics.service'
import { ApplicationService } from './services/app.service'
import { SettingsService, IconMode } from './sections/settings/settings.service'
import { OptionsDialogComponent } from './components/options-dialog/options-dialog.component'
import { Option, Options } from './components/options/options.component'
import { HeaderComponent } from './sections/header/header.component'
import { VolumeBoosterBalanceComponent } from './sections/volume/booster-balance/volume-booster-balance.component'
import { EqualizersComponent } from './sections/effects/equalizers/equalizers.component'
import { OutputsComponent } from './sections/outputs/outputs.component'

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: [ './app.component.scss' ],
  animations: [ FadeInOutAnimation, FromTopAnimation ]
})

export class AppComponent implements OnInit, AfterContentInit {
  @ViewChild('container', { static: true }) container
  @ViewChild('header', { static: true }) header: HeaderComponent
  @ViewChild('volumeBoosterBalance', { static: false }) volumeBoosterBalance: VolumeBoosterBalanceComponent
  @ViewChild('equalizers', { static: false }) equalizers: EqualizersComponent
  @ViewChild('outputs', { static: false }) outputs: OutputsComponent

  loaded = false
  animationDuration = 500
  animationFps = 30

  showDropdownSections = {
    settings: false,
    help: false
  }

  get containerStyle () {
    const style: any = {}

    style.width = `${100 / this.ui.scale}%`
    style.height = `${100 / this.ui.scale}%`
    style.transform = `scale(${this.ui.scale})`

    return style
  }

  constructor (
    public utils: UtilitiesService,
    public ui: UIService,
    public dialog: MatDialog,
    public transitions: TransitionService,
    public analytics: AnalyticsService,
    public app: ApplicationService,
    public settings: SettingsService
  ) {
    this.app.ref = this
  }

  get minHeight () {
    const divider = 3

    const {
      volumeFeatureEnabled, balanceFeatureEnabled,
      equalizersFeatureEnabled,
      outputFeatureEnabled
    } = this.ui.settings
    let minHeight = this.header.height + divider +
      ((volumeFeatureEnabled || balanceFeatureEnabled) ? (this.volumeBoosterBalance.height + divider) : 0) +
      (equalizersFeatureEnabled ? (this.equalizers.height + divider) : 0) +
      (outputFeatureEnabled ? this.outputs.height : 0)

    const dropdownSection = document.getElementById('dropdown-section')
    if (dropdownSection) {
      const dropdownHeight = dropdownSection.offsetHeight + this.header.height + divider
      if (dropdownHeight > minHeight) {
        minHeight = dropdownHeight
      }
    }

    return minHeight
  }

  get minWidth () {
    return 400
  }

  get maxHeight () {
    const divider = 3

    const {
      volumeFeatureEnabled, balanceFeatureEnabled,
      equalizersFeatureEnabled,
      outputFeatureEnabled
    } = this.ui.settings
    let maxHeight = this.header.height + divider +
      ((volumeFeatureEnabled || balanceFeatureEnabled) ? (this.volumeBoosterBalance.height + divider) : 0) +
      (equalizersFeatureEnabled ? (this.equalizers.maxHeight + divider) : 0) +
      (outputFeatureEnabled ? this.outputs.height : 0)

    const dropdownSection = document.getElementById('dropdown-section')
    if (dropdownSection) {
      const dropdownHeight = dropdownSection.offsetHeight + this.header.height + divider
      if (dropdownHeight > maxHeight) {
        maxHeight = dropdownHeight
      }
    }

    return maxHeight
  }

  async ngOnInit () {
    await this.sync()
    await this.fixUIMode()
    this.startDimensionsSync()
    await this.setupPrivacy()
  }

  async setupPrivacy () {
    const [ uiSettings ] = await Promise.all([
      this.ui.getSettings()
    ])

    if (typeof uiSettings.privacyFormSeen !== 'boolean') {
      let doCollectTelemetry = uiSettings.doCollectTelemetry ?? false
      let doCollectCrashReports = await this.settings.getDoCollectCrashReports()
      let saving = false

      const doCollectTelemetryOption: Option = {
        type: 'checkbox',
        label: 'Send Anonymous Analytics data',
        tooltip: `
eqMac would collect anonymous Telemetry analytics data like:

• macOS Version
• App and UI Version
• Country (IP Addresses are anonymized)

This helps us understand distribution of our users.
`,
        tooltipAsComponent: true,
        value: doCollectTelemetry,
        isEnabled: () => !saving,
        toggled: doCollect => {
          doCollectTelemetry = doCollect
        }
      }

      const doCollectCrashReportsOption: Option = {
        type: 'checkbox',
        label: 'Send Anonymous Crash reports',
        tooltip: `
eqMac would send anonymized crash reports
back to the developer in case eqMac crashes.
This helps us understand improve eqMac 
and make it a more stable product.
`,
        tooltipAsComponent: true,
        value: doCollectCrashReports,
        isEnabled: () => !saving,
        toggled: doCollect => {
          doCollectCrashReports = doCollect
        }
      }
      const privacyDialog: MatDialogRef<OptionsDialogComponent> = this.dialog.open(OptionsDialogComponent, {
        hasBackdrop: true,
        disableClose: true,
        data: {
          options: [
            [ { type: 'label', label: 'Privacy' } ],
            [ {
              type: 'label', label: `eqMac respects it's user's privacy 
and is giving you a choice what data you wish to share with the developer.
This data would help us improve and grow the product.`
            } ],
            [ doCollectTelemetryOption ],
            [ doCollectCrashReportsOption ],
            [
              {
                type: 'button',
                label: 'Save',
                isEnabled: () => !saving,
                action: () => privacyDialog.close()
              },
              {
                type: 'button',
                label: 'Accept all',
                isEnabled: () => !saving,
                action: async () => {
                  doCollectCrashReports = true
                  doCollectTelemetry = true
                  doCollectCrashReportsOption.value = true
                  doCollectTelemetryOption.value = true
                  saving = true
                  await this.utils.delay(200)
                  privacyDialog.close()
                }
              }
            ]
          ] as Options
        }
      })

      await privacyDialog.afterClosed().toPromise()

      await Promise.all([
        this.ui.setSettings({
          privacyFormSeen: true,
          doCollectTelemetry
        }),
        this.settings.setDoCollectCrashReports({
          doCollectCrashReports
        })
      ])
    }

    if (uiSettings.doCollectTelemetry) {
      await this.analytics.init()
    }
  }

  async ngAfterContentInit () {
    await this.utils.delay(this.animationDuration)
    this.loaded = true
    this.ui.loaded()
  }

  async sync () {
    await Promise.all([
      this.getTransitionSettings()
    ])
  }

  async startDimensionsSync () {
    setInterval(() => {
      this.syncMinHeight()
      this.syncMaxHeight()
    }, 1000)
  }

  private previousMinHeight
  async syncMinHeight () {
    const diff = this.minHeight - this.previousMinHeight
    this.previousMinHeight = this.minHeight
    if (diff !== 0) {
      await this.ui.setMinHeight({ minHeight: this.minHeight })
      this.ui.changeHeight({ diff })
    }
  }

  private previousMinWidth
  async syncMinWidth () {
    const diff = this.minWidth - this.previousMinWidth
    this.previousMinWidth = this.minWidth
    if (diff !== 0) {
      await this.ui.setMinWidth({ minWidth: this.minWidth })
      this.ui.changeWidth({ diff })
    }
  }

  private previousMaxHeight
  async syncMaxHeight () {
    const diff = this.maxHeight - this.previousMaxHeight
    this.previousMaxHeight = this.maxHeight
    if (diff !== 0) {
      await this.ui.setMaxHeight({ maxHeight: this.maxHeight })
      this.ui.changeHeight({ diff })
    }
  }

  async getTransitionSettings () {
    const settings = await this.transitions.getSettings()
    this.animationDuration = settings.duration
    this.animationFps = settings.fps
  }

  toggleDropdownSection (section: string) {
    for (const key in this.showDropdownSections) {
      this.showDropdownSections[key] = key === section ? !this.showDropdownSections[key] : false
    }
  }

  async fixUIMode () {
    const [ mode, iconMode ] = await Promise.all([
      this.ui.getMode(),
      this.settings.getIconMode()
    ])

    if (mode === 'popover' && iconMode === IconMode.dock) {
      await this.ui.setMode('window')
    }
  }

  closeDropdownSection (section: string, event?: any) {
    // if (event && event.target && ['backdrop', 'mat-dialog'].some(e => event.target.className.includes(e))) return
    if (this.dialog.openDialogs.length > 0) return
    if (section in this.showDropdownSections) {
      this.showDropdownSections[section] = false
    }
  }
}
