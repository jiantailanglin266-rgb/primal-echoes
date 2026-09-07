# COPY DECK — ゲーム内全テキスト

生成: 2026-09-07（`node scripts/copy-deck.mjs`）。原本は `src/i18n/ja.json` / `en.json`。ここで直し、JSON へ反映する。

規約: BRAND_BIBLE §4（常体、一文 40 字以内、感嘆符なし、世界の外の言葉を出さない、ボタンは動詞で終える）。

## ブランド（`brand`）

| キー | 日本語 | English |
|---|---|---|
| `brand.title` | PRIMAL ECHOES | PRIMAL ECHOES |
| `brand.subtitle` | 原初の残響 | The First World, Still Echoing |
| `brand.tagline` | 原初は、まだ鳴っている。 | The first world still echoes. |
| `brand.studio` | Hollow Signal | Hollow Signal |

## タイトル画面（`title`）

| キー | 日本語 | English |
|---|---|---|
| `title.call` | 耳を澄ませ | Listen. |
| `title.hint` | 鍵を押す、または画面に触れる | Press any key, or touch the screen |

## メインメニュー（`menu`）

| キー | 日本語 | English |
|---|---|---|
| `menu.eyebrow` | Verdant Outpost | Verdant Outpost |
| `menu.hunt` | 狩りに出る | Hunt |
| `menu.huntEyebrow` | Hunt | Into the gorge |
| `menu.codex` | 図鑑 | Codex |
| `menu.codexEyebrow` | Codex | Beasts |
| `menu.settings` | 設定 | Settings |
| `menu.settingsEyebrow` | Settings | Options |
| `menu.credits` | 語り部 | Tellers |
| `menu.creditsEyebrow` | Credits | Credits |

## ローディング（`loading`）

| キー | 日本語 | English |
|---|---|---|
| `loading.listening` | 耳を澄ませている | Listening |
| `loading.steps.world` | 大陸を起こす | Waking the continent |
| `loading.steps.assets` | 痕跡を辿る | Following the traces |
| `loading.steps.sky` | 空を写す | Reading the sky |
| `loading.steps.shaders` | 刃を研ぐ | Whetting the blade |
| `loading.steps.warm` | 目を慣らす | Letting the eyes adjust |
| `loading.steps.done` | 耳を澄ませた | Listening |
| `loading.flavor[1]` | ヴァルディアは、海図の外にある大陸だ。 | Valdia lies beyond the edge of every chart. |
| `loading.flavor[2]` | この地の生き物は、体の内に「残響」を宿している。 | Every living thing here carries an echo inside its body. |
| `loading.flavor[3]` | 残響とは、世界が生まれた最初の時代の力の、消えずに残る反響だという。 | An echo, they say, is the sound of the first age, still refusing to fade. |
| `loading.flavor[4]` | 大陸の岩盤には、原初の力が層をなして眠っている。 | Beneath the bedrock, the first power sleeps in layers. |
| `loading.flavor[5]` | 前哨の柱は獣の骨で組まれている。折れたことはない。 | The outpost pillars are beast bone. None has ever broken. |
| `loading.flavor[6]` | 足跡は嘘をつかない。深さは重さを、間隔は急ぎを語る。 | Tracks do not lie. Depth tells weight; spacing tells haste. |
| `loading.flavor[7]` | 食い荒らされた草は、獣が腹を満たしたばかりだと教える。 | Grazed-down grass means the beast has only just fed. |
| `loading.flavor[8]` | 雨の日、獣は洞へ退く。追うなら、その前に。 | In rain, beasts withdraw to the hollows. Hunt before it falls. |
| `loading.flavor[9]` | 白瀬の水は冷たい。獣も、そこで喉を潤す。 | The Whitewater runs cold. The beast drinks there too. |
| `loading.flavor[10]` | 獣の甲殻の亀裂が光るのは、原初の力が表面に滲むからだ。 | A beast's shell cracks with light when the first power seeps to the surface. |
| `loading.flavor[11]` | 怒りとは、残響が沸き立つことだ。獣は憎んでいない。 | Rage is the echo boiling over. The beast does not hate you. |
| `loading.flavor[12]` | 深く傷ついた獣は寝床へ戻る。寝床を知る者だけが、その先へ行ける。 | A deeply wounded beast returns to its den. Only those who know the den go further. |
| `loading.flavor[13]` | 残響の宿る部位ほど硬い。だから、砕けば刃の糧になる。 | The part that holds the most echo is the hardest. Break it, and it feeds the blade. |
| `loading.flavor[14]` | 鍛冶場では、素材の残響を火で起こし、刃へ移す。 | At the forge, the echo in a shard is woken with fire and moved into steel. |
| `loading.flavor[15]` | 鉛の弾は残響の甲殻を貫かない。だから、狩人は刃を持つ。 | Lead shot cannot pierce an echoing shell. That is why hunters carry blades. |
| `loading.flavor[16]` | 「岩が動いた」と最初に書いた狩人は、帰ってこなかった。 | The first hunter to write 'the rock moved' never came back. |
| `loading.flavor[17]` | スカルヴは臆病だが、死の匂いには誰より早い。 | Skarv are cowards, but no one smells death sooner. |
| `loading.flavor[18]` | グラストの群れが逃げる方向を見ろ。獣はその反対にいる。 | Watch which way the Grast herd runs. The beast is the other way. |
| `loading.flavor[19]` | 獣の名は、鳴き声を聞いた狩人が、それに似せてつけた。 | A beast's name is the sound a hunter made after hearing its call. |
| `loading.flavor[20]` | 前哨に地図はない。狩人が持ち帰った痕跡だけがある。 | The outpost keeps no map. Only the traces hunters carried home. |
| `loading.flavor[21]` | 谷の奥に、人のものではない環状の石列がある。誰も近づかない。 | Deep in the gorge stands a ring of stones no human raised. No one goes near. |
| `loading.flavor[22]` | 地層に埋もれた骨の壁は、いまの獣より二回り大きい。 | The bone walls buried in the strata are twice the size of any beast alive. |
| `loading.flavor[23]` | 古い狩人は言う。「大陸は、こちらを聴いている」と。 | The old hunters say the continent is listening back. |
| `loading.flavor[24]` | 咆哮のあとの静けさに、耳を澄ませ。次の一歩が聞こえる。 | In the silence after a roar, listen. You will hear the next step. |
| `loading.flavor[25]` | 残響は消えない。薄れるだけだ。それが原初の性質だという。 | An echo never dies. It only thins. That, they say, is the nature of the first world. |
| `loading.flavor[26]` | 刃が鈍るのは、残響が抜けていくからだ。研げば戻る。 | A blade dulls as the echo drains from it. Whet it, and it returns. |
| `loading.flavor[27]` | 膝をついても、狩りは終わらない。前哨で目を覚ますだけだ。 | Falling to your knees does not end the hunt. You only wake at the outpost. |
| `loading.flavor[28]` | 獣が眠るとき、残響も静まる。その甲殻は、いちばん脆い。 | When a beast sleeps, its echo stills. Its shell is never softer. |
| `loading.flavor[29]` | 沿岸の霧が晴れる朝、大陸の奥から、低い音が届くことがある。 | On mornings when the coastal fog lifts, a low sound reaches from the interior. |
| `loading.flavor[30]` | 原初は、まだ鳴っている。 | The first world still echoes. |

## 前哨（拠点）（`hub`）

| キー | 日本語 | English |
|---|---|---|
| `hub.eyebrow` | Verdant Outpost | Verdant Outpost |
| `hub.title` | 翠嵐前哨 | Verdant Outpost |
| `hub.lead` | 狩人よ。獣を選び、刃を確かめてから出よ。 | Hunter. Choose the beast, check the blade, then go. |
| `hub.hunter` | 狩人 | Hunter |
| `hub.blade` | 刃 | Blade |
| `hub.materials` | 素材 | Materials |
| `hub.journal` | 手帳 | Journal |
| `hub.hunts` | 狩り | Hunts |
| `hub.forge` | 鍛冶場 | Forge |
| `hub.save` | 書き留める | Write it down |
| `hub.burn` | 手帳を焼く | Burn the journal |
| `hub.burnConfirm` | 手帳を焼く。素材と鍛えた刃が失われる。 | Burn the journal. Materials and every tempered blade will be lost. |
| `hub.back` | 戻る | Back |
| `hub.bladeLine` | 刃: {name} | Blade: {name} |
| `hub.statLine` | 攻撃 {power} / 鍛え {level} / {sharpness} | Attack {power} / Temper {level} / {sharpness} |
| `hub.hpLine` | 体力 {hp} | Vitality {hp} |
| `hub.clearsLine` | 討伐 {n} 度 | Hunts concluded: {n} |
| `hub.savedAt` | 記した日: {date} | Written on {date} |
| `hub.unsaved` | 手帳はまだ白い。狩りの終わりと鍛えで自ずと記される | The journal is still blank. It writes itself at the end of a hunt and at the forge. |
| `hub.none` | なし | None |
| `hub.weaponOption` | {name}　攻 {power} / 鍛え {level} | {name}  Atk {power} / Temper {level} |
| `hub.maxed` | この刃は鍛え尽くした | This blade is tempered to its limit. |
| `hub.forgeButton` | 鍛える | Temper |
| `hub.forgeResult` | 攻撃 {from} → {to} / {sharpness} / 会心 {crit}% | Attack {from} → {to} / {sharpness} / Crit {crit}% |
| `hub.materialLine` | {name}　{owned}/{required} | {name}  {owned}/{required} |
| `hub.timeLimit` | 刻限 | Time |
| `hub.timeValue` | {minutes} 分 | {minutes} min |
| `hub.knees` | 膝をつく | Knees |
| `hub.kneesValue` | {n} 度で退く | Retreat after {n} |
| `hub.start` | 狩りに出る | Hunt |
| `hub.questType.hunt` | 討伐 | Hunt |
| `hub.questType.capture` | 捕獲 | Capture |
| `hub.questType.investigation` | 調査 | Survey |
| `hub.questType.gathering` | 採取 | Gather |
| `hub.questType.survival` | 生存 | Survive |
| `hub.questType.multiHunt` | 連続討伐 | Twin hunt |

## 設定（`settings`）

| キー | 日本語 | English |
|---|---|---|
| `settings.eyebrow` | Settings | Settings |
| `settings.title` | 設定 | Settings |
| `settings.quality` | 画質 | Quality |
| `settings.low` | 低 | Low |
| `settings.mid` | 中 | Medium |
| `settings.high` | 高 | High |
| `settings.volume` | 音量 | Volume |
| `settings.language` | 言語 | Language |
| `settings.controls` | 操作 | Controls |
| `settings.note` | ゲームパッドは標準配置に対応する。メニューは十字キーと A / B。 | Standard gamepads are supported. Menus use the d-pad and A / B. |
| `settings.back` | 戻る | Back |
| `settings.actions.moveForward` | 前へ | Forward |
| `settings.actions.moveBackward` | 後ろへ | Back |
| `settings.actions.moveLeft` | 左へ | Left |
| `settings.actions.moveRight` | 右へ | Right |
| `settings.actions.dash` | 駆ける | Run |
| `settings.actions.dodge` | 躱す | Evade |
| `settings.actions.lightAttack` | 斬る | Cut |
| `settings.actions.heavyAttack` | 振り下ろす（長押しで溜め） | Heavy cut (hold to charge) |
| `settings.actions.lockOn` | 獣を見据える | Fix on the beast |
| `settings.actions.interact` | 剥ぐ・崩す | Carve / topple |
| `settings.actions.useItem` | 薬を飲む | Drink |
| `settings.actions.pause` | 静止 | Still |

## 図鑑（画面）（`codex`）

| キー | 日本語 | English |
|---|---|---|
| `codex.eyebrow` | Codex | Codex |
| `codex.title` | 図鑑 | Codex |
| `codex.unknown` | 記録なし | No record |
| `codex.unknownEyebrow` | Unknown | Unknown |
| `codex.unknownText` | 痕跡は見つかっていない。狩りに出て、この頁を埋めよ。 | No trace found yet. Go out and fill this page. |
| `codex.empty` | まだ何も記されていない。 | Nothing has been written yet. |
| `codex.habitat` | 生息域 | Range |
| `codex.ecology` | 生態 | Ecology |
| `codex.hint` | 観察の手がかり | What to watch for |
| `codex.sighting` | 目撃記録 | Sighting |
| `codex.back` | 戻る | Back |

## 語り部（`credits`）

| キー | 日本語 | English |
|---|---|---|
| `credits.eyebrow` | Credits | Credits |
| `credits.title` | 語り部 | Tellers |
| `credits.made` | 制作 | Made by |
| `credits.design` | 設計・実装 | Design and code |
| `credits.designText` | Kenta | Kenta |
| `credits.world` | 世界と獣 | World and beasts |
| `credits.worldText` | すべてこの作品のために新しく作られた。既存の作品から借りたものは何もない。 | Everything was made new for this work. Nothing was borrowed from existing games. |
| `credits.tech` | 技術 | Technology |
| `credits.techText` | TypeScript / Three.js / Vite / Web Audio | TypeScript / Three.js / Vite / Web Audio |
| `credits.fonts` | 書体 | Type |
| `credits.fontsText` | Cinzel（Natanael Gama）、Shippori Mincho（FONTDASU）、Cormorant Garamond（Christian Thalmann）— SIL Open Font License | Cinzel (Natanael Gama), Shippori Mincho (FONTDASU), Cormorant Garamond (Christian Thalmann) — SIL Open Font License |
| `credits.sound` | 音 | Sound |
| `credits.soundText` | 合成音（Web Audio）。素材音源を使う場合は README に出典を記す | Synthesised with Web Audio. Any sampled sources are credited in the README. |
| `credits.thanks` | 感謝 | Thanks |
| `credits.thanksText` | この大陸に耳を澄ませてくれた、すべての狩人に。 | To every hunter who stopped to listen to this continent. |
| `credits.close` | 原初は、まだ鳴っている。 | The first world still echoes. |
| `credits.back` | 戻る | Back |

## 静止（`pause`）

| キー | 日本語 | English |
|---|---|---|
| `pause.eyebrow` | Still | Still |
| `pause.title` | 静止 | Still |
| `pause.resume` | 続ける | Continue |
| `pause.resumeEyebrow` | Resume | Resume |
| `pause.settings` | 設定 | Settings |
| `pause.settingsEyebrow` | Settings | Options |
| `pause.retreat` | 狩りを退く | Leave the hunt |
| `pause.retreatEyebrow` | Retreat | Retreat |

## 討伐・帰還（`result`）

| キー | 日本語 | English |
|---|---|---|
| `result.concluded` | Hunt Concluded | Hunt Concluded |
| `result.returned` | Returned | Returned |
| `result.time` | 討伐まで | Time to the kill |
| `result.damage` | 与えた傷 | Wounds dealt |
| `result.hits` | 受けた傷 | Wounds taken |
| `result.downs` | 膝をついた | Knees |
| `result.parts` | 砕いた部位 | Parts broken |
| `result.rewards` | 持ち帰った素材 | Carried home |
| `result.none` | なし | None |
| `result.again` | もう一度 | Once more |
| `result.retry` | 再び向かう | Go back in |
| `result.outpost` | 前哨へ | To the outpost |
| `result.killLines[1]` | 残響が、静まった。 | The echo has stilled. |
| `result.killLines[2]` | 谷は、いまだけ静かだ。 | The gorge is quiet, for now. |
| `result.killLines[3]` | 岩が、動くのをやめた。 | The rock has stopped moving. |
| `result.killLines[4]` | 刃は応えた。獣も応えた。 | The blade answered. So did the beast. |
| `result.killLines[5]` | 持ち帰れ。痕跡と、素材と、この静けさを。 | Carry it home: the traces, the shards, and this silence. |
| `result.returnLines.timeLimit[1]` | 刻限が過ぎた。獣は谷に残っている。 | The hour has passed. The beast remains in the gorge. |
| `result.returnLines.timeLimit[2]` | 夜が来る前に、前哨へ。獣は逃げない。 | Back to the outpost before night. The beast will not run. |
| `result.returnLines.timeLimit[3]` | 今日は追い切れなかった。痕跡は明日も残る。 | You could not close the distance today. The tracks will still be there tomorrow. |
| `result.returnLines.timeLimit[4]` | 刻限は狩人を守るためにある。退け。 | The hour exists to keep hunters alive. Withdraw. |
| `result.returnLines.timeLimit[5]` | 谷が暗くなった。次は、朝から追え。 | The gorge has gone dark. Next time, start at dawn. |
| `result.returnLines.downs[1]` | 三度、膝をついた。今日はここまでだ。 | Three times to your knees. That is enough for today. |
| `result.returnLines.downs[2]` | 獣は強かった。それを知ったのが今日の収穫だ。 | The beast was strong. Knowing that is today's harvest. |
| `result.returnLines.downs[3]` | 傷は前哨で癒える。獣の癖は、頭に残る。 | Wounds heal at the outpost. The beast's habits stay in your head. |
| `result.returnLines.downs[4]` | 倒れた場所を憶えておけ。次はそこで躱す。 | Remember where you fell. Next time, evade there. |
| `result.returnLines.downs[5]` | 退くのも狩りのうちだ。骨は折れていない。 | Withdrawing is part of the hunt. Nothing is broken. |
| `result.returnLines.none[1]` | 狩りを退いた。獣はまだ谷にいる。 | You left the hunt. The beast is still in the gorge. |
| `result.returnLines.none[2]` | 前哨へ戻る。痕跡は消えない。 | Back to the outpost. The traces will not fade. |
| `result.returnLines.none[3]` | 今日は追わない。それも判断だ。 | Not today. That, too, is a decision. |
| `result.returnLines.none[4]` | 刃を研ぎ直せ。谷は待っている。 | Whet the blade again. The gorge will wait. |
| `result.returnLines.none[5]` | 退いた。次に向かうとき、獣は同じ場所で水を飲んでいる。 | You withdrew. When you return, the beast will be drinking in the same place. |

## 戦闘 HUD（`hud`）

| キー | 日本語 | English |
|---|---|---|
| `hud.knees` | 膝 | Knees |
| `hud.objectiveHunt` | {name} を討て | Bring down {name} |
| `hud.objectiveReturn` | 討った。{seconds} 秒で前哨へ。いまなら剥げる | Done. {seconds}s to the outpost. Carve now |
| `hud.objectiveDone` | 狩りは終わった | The hunt is over |
| `hud.objectiveFailed` | 前哨へ戻る | Return to the outpost |
| `hud.respawn` | 膝をついた。{seconds} 秒ののち、前哨で目を覚ます | You fell. You wake at the outpost in {seconds}s |
| `hud.carving` | 剥いでいる | Carving |
| `hud.carve` | E　剥ぐ（残り {n}） | E  Carve ({n} left) |
| `hud.topple` | E　{name}を崩す | E  Topple the {name} |
| `hud.itemKey` | H | H |
| `hud.tutorial[1]` | W A S D　歩く | W A S D  walk |
| `hud.tutorial[2]` | Shift　駆ける | Shift  run |
| `hud.tutorial[3]` | Space　躱す | Space  evade |
| `hud.tutorial[4]` | J / K　斬る / 振り下ろす | J / K  cut / heavy cut |
| `hud.tutorial[5]` | Tab　獣を見据える | Tab  fix on the beast |
| `hud.tutorial[6]` | H　薬を飲む | H  drink |
| `hud.tutorialVoice` | ――先達の手記より。「まず歩け。獣が見えたら見据えろ。刃は、それからだ」 | — from an elder's notes. "Walk first. When you see the beast, fix on it. The blade comes after." |
| `hud.banners.broke` | {part}を砕いた | {part} broken |
| `hud.banners.severed` | {part}を断った | {part} severed |
| `hud.banners.slain` | {name}を討った | {name} brought down |
| `hud.notices.stun` | 気絶 | Stunned |
| `hud.notices.topple` | 転倒 | Toppled |
| `hud.notices.rainStart` | 雨が降り始めた | Rain begins |
| `hud.notices.rainStop` | 雨が上がった | Rain lifts |
| `hud.notices.rockHit` | 落石が直撃した | The rockfall struck |
| `hud.notices.rockMiss` | 落石は外れた | The rockfall missed |
| `hud.notices.got` | {name} ×{n} を得た | {name} ×{n} |
| `hud.notices.nothing` | 何も得られなかった | Nothing gained |
| `hud.notices.used` | {name} を飲んだ（残り {n}） | Drank {name} ({n} left) |
| `hud.sharpness.dull` | 斬れ味: 鈍 | Edge: dull |
| `hud.sharpness.normal` | 斬れ味: 並 | Edge: fair |
| `hud.sharpness.sharp` | 斬れ味: 鋭 | Edge: keen |
| `hud.sharpness.keen` | 斬れ味: 冴 | Edge: bright |
| `hud.failReason.timeLimit` | 刻限が過ぎた | The hour passed |
| `hud.failReason.downs` | 三度、膝をついた | Three times to your knees |
| `hud.failReason.none` | 狩りを退いた | You left the hunt |
| `hud.badges.enraged` | 怒り | Enraged |
| `hud.badges.exhausted` | 疲労 | Exhausted |
| `hud.badges.dying` | 瀕死 | Dying |
| `hud.badges.sleeping` | 睡眠 | Asleep |
| `hud.badges.eating` | 捕食中 | Feeding |
| `hud.badges.broken` | {part} 破壊 | {part} broken |
| `hud.badges.severed` | {part} 切断 | {part} severed |

## データ名・世界のテキスト（`data`）

| キー | 日本語 | English |
|---|---|---|
| `data.fields.verdant_tempest` | 翠嵐峡谷 | Verdant Gorge |
| `data.areas.base_camp` | 前哨 | The Outpost |
| `data.areas.forest` | 苔の谷底 | The Mossfloor |
| `data.areas.river` | 白瀬 | The Whitewater |
| `data.areas.cave` | 獣の寝床 | The Hollow |
| `data.areaCatch.base_camp` | 骨の柱の下で、刃を研ぐ | Whet the blade beneath the bone pillars |
| `data.areaCatch.forest` | 苔が音を吸う。足跡だけが残る | Moss swallows sound. Only the tracks remain |
| `data.areaCatch.river` | 水音の向こうに、獣がいる | Beyond the water's noise, the beast |
| `data.areaCatch.cave` | ここで獣は眠る。ここで獣は最も脆い | Here the beast sleeps. Here it is softest |
| `data.areaIntro.base_camp` | 沿岸に築かれた小さな前哨。獣の骨で組んだ柱と、石の鍛冶場がある。狩人はここで刃を鍛え、痕跡を書き留め、谷へ向かう。大陸で唯一、夜に火を灯せる場所。 | A small outpost on the coast: pillars of beast bone and a stone forge. Hunters temper blades here, write down the traces, and set out for the gorge. The only place on the continent where a fire burns at night. |
| `data.areaIntro.forest` | 谷の底に苔が厚く積もり、足音を吸い込む。倒木の陰にグラストの群れが草を食み、その先にはいつも大きな足跡がある。雨が降ると苔は光を帯び、残響の濃さを教える。 | Moss lies thick on the valley floor and swallows footsteps. Grast herds graze in the shade of fallen trunks, and beyond them there is always a larger print. When rain falls the moss glows faintly, showing how dense the echo runs. |
| `data.areaIntro.river` | 谷を割って流れる白い早瀬。獣はここで喉を潤し、岸辺の岩を寝返りで削る。増水の日は近づくな。水の下に何かがいる、と古い狩人は言う。 | A white rapid that splits the gorge. The beast drinks here and grinds the bank stones as it rolls. Keep away on flood days. Something lives under the water, the old hunters say. |
| `data.areaIntro.cave` | 崖の根元に口を開けた洞。奥は原初の力が濃く、獣は傷を負うとここへ退く。天井から岩棚が崩れかけている。眠る獣は、甲殻の残響が静まっている。 | A hollow opening at the cliff's root. The first power runs dense inside, and the wounded beast withdraws here. Rock ledges hang loose from the ceiling. A sleeping beast's shell has gone quiet. |
| `data.gimmicks.rockfall_cave_mouth` | 崩れ岩棚 | Loose ledge |
| `data.gimmicks.rockfall_forest_edge` | 崩れ岩棚 | Loose ledge |
| `data.quests.vs01_hunt_valgaron` | 峡谷の岩王 | The Gorge Sovereign |
| `data.questDesc.vs01_hunt_valgaron` | 苔の谷底に、岩の甲殻をまとう原獣ヴァルガロンの縄張りがある。昼は谷底で草食の群れを追い、白瀬で水を飲む。深く傷つけば寝床へ退く。痕跡を読み、向き合え。 | Valgaron, a primal beast in a shell of rock, holds the Mossfloor. By day it drives the grazing herds and drinks at the Whitewater; wounded, it withdraws to its den. Read the traces and face it. |
| `data.monsters.valgaron` | ヴァルガロン | Valgaron |
| `data.monsterTitles.valgaron` | 峡谷の岩王 | The Gorge Sovereign |
| `data.parts.head` | 角 | Horn |
| `data.parts.body` | 甲殻 | Shell |
| `data.parts.foreleg_l` | 左前脚 | Left foreleg |
| `data.parts.foreleg_r` | 右前脚 | Right foreleg |
| `data.parts.hindleg_l` | 左後脚 | Left hindleg |
| `data.parts.hindleg_r` | 右後脚 | Right hindleg |
| `data.parts.tail` | 尾 | Tail |
| `data.creatures.grast` | グラスト | Grast |
| `data.creatures.skarv` | スカルヴ | Skarv |
| `data.weapons.titan_blade` | 巨断刀 | Titan Blade |
| `data.weapons.rift_saber` | 裂空剣 | Rift Saber |
| `data.weapons.break_hammer` | 砕岩槌 | Break Hammer |
| `data.weapons.arc_bow` | 弧月弓 | Arc Bow |
| `data.recipes.titan_blade_lv1` | 巨断刀・壱（岩鱗） | Titan Blade I (Rockscale) |
| `data.recipes.titan_blade_lv2` | 巨断刀・弐（大爪） | Titan Blade II (Great Claw) |
| `data.recipes.titan_blade_lv3` | 巨断刀・参（岩王） | Titan Blade III (Sovereign) |
| `data.recipes.rift_saber_lv1` | 裂空剣・壱（残響片） | Rift Saber I (Echo Shard) |
| `data.recipes.rift_saber_lv2` | 裂空剣・弐（牙裂） | Rift Saber II (Fang) |
| `data.recipes.break_hammer_lv1` | 砕岩槌・壱（大爪） | Break Hammer I (Great Claw) |
| `data.recipes.break_hammer_lv2` | 砕岩槌・弐（角砕） | Break Hammer II (Hornbreaker) |
| `data.items.valgaron_scale` | ヴァルガロンの岩鱗 | Valgaron rockscale |
| `data.items.valgaron_fang` | ヴァルガロンの牙 | Valgaron fang |
| `data.items.valgaron_claw` | ヴァルガロンの大爪 | Valgaron great claw |
| `data.items.valgaron_horn` | ヴァルガロンの角 | Valgaron horn |
| `data.items.valgaron_tail` | ヴァルガロンの尾甲 | Valgaron tail plate |
| `data.items.echo_core` | 残響核 | Echo core |
| `data.items.echo_shard` | 残響片 | Echo shard |
| `data.items.grast_hide` | グラストの毛皮 | Grast hide |
| `data.items.grast_meat` | グラストの肉 | Grast meat |
| `data.items.skarv_talon` | スカルヴの鉤爪 | Skarv talon |
| `data.items.vital_tonic` | 蘇生薬 | Restorative |
| `data.itemDesc.valgaron_scale` | 岩のように硬い甲殻の欠片。残響をわずかに宿す。 | A shard of rock-hard shell. Holds a faint echo. |
| `data.itemDesc.valgaron_fang` | 獲物を噛み砕く顎の牙。 | A fang from jaws that crush their prey. |
| `data.itemDesc.valgaron_claw` | 前脚の大きな爪。砕いた前脚から得やすい。 | A great claw from the foreleg. Easier to take from a broken leg. |
| `data.itemDesc.valgaron_horn` | 頭の角。砕かなければ手に入らない。 | The horn. It can only be taken once broken. |
| `data.itemDesc.valgaron_tail` | 断った尾の装甲板。 | An armour plate from a severed tail. |
| `data.itemDesc.echo_core` | 原獣の体内で凝った残響の核。刃の心臓になる。 | An echo condensed inside a primal beast. It becomes the heart of a blade. |
| `data.itemDesc.echo_shard` | 残響が結晶した欠片。 | A fragment of crystallised echo. |
| `data.itemDesc.grast_hide` | 草食のグラストの厚い毛皮。 | The thick hide of the grazing Grast. |
| `data.itemDesc.grast_meat` | スカルヴが好む生肉。 | Raw meat. Skarv are fond of it. |
| `data.itemDesc.skarv_talon` | 腐肉食のスカルヴの鋭い鉤爪。 | The sharp talon of a carrion-eating Skarv. |
| `data.itemDesc.vital_tonic` | 残響を宿す草を煎じた薬。飲むあいだは無防備になる。 | A decoction of echo-bearing herbs. You are defenceless while drinking. |
| `data.beasts.valgaron.kind` | 四足の原獣 | Four-legged primal beast |
| `data.beasts.valgaron.habitat` | 翠嵐峡谷 — 苔の谷底、白瀬、獣の寝床 | Verdant Gorge — the Mossfloor, the Whitewater, the Hollow |
| `data.beasts.valgaron.ecology` | 岩のような甲殻をまとう。昼は谷底でグラストの群れを追い、白瀬で喉を潤し、疲れれば寝床で眠る。深く傷つくと寝床へ退き、雨が来れば洞へ入る。怒りは憎しみではなく、体内の残響が沸き立つこと。甲殻の亀裂が光るのはそのときだ。 | Wears a shell like rock. By day it drives the Grast herds across the valley floor, drinks at the Whitewater, and sleeps in its den when tired. Deeply wounded, it withdraws to the den; when rain comes, it enters the hollow. Its rage is not hatred but the echo inside it boiling over. That is when the cracks in its shell begin to glow. |
| `data.beasts.valgaron.hint` | 亀裂が光を帯びたとき、角に力が集まり、熱を持つ。尾は根元が薄い。脚は前から砕ける。眠っているあいだ、甲殻の残響は静まる。 | When the cracks glow, power gathers in the horn and it runs hot. The tail is thin at its root. The legs break from the front. While it sleeps, the echo in the shell goes quiet. |
| `data.beasts.valgaron.sighting` | 「岩が動いた」と最初に書いた狩人は、帰ってこなかった。二人目は、足跡の深さを書き残した。 | The first hunter to write 'the rock moved' never came back. The second wrote down the depth of the tracks. |

合計 288 項目。
