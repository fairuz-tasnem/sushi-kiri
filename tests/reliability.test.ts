import test from 'node:test'
import assert from 'node:assert/strict'
import { commandDestination, parseVoice } from '../src/game/commands.ts'
import { createFingertip, advanceFingertip, resetFingertip, trySliceSushi, segmentIntersectsRect } from '../src/game/slicing.ts'
import { createScoreState, applyCut, updateScoreState } from '../src/game/scoring.ts'
import { gameConfig } from '../src/game/gameConfig.ts'
import { createGameLoop } from '../src/game/gameLoop.ts'
import { readPreferences, savePreferences } from '../src/game/preferences.ts'
import { mapVideoPointToScreen } from '../src/vision/coordinateMapper.ts'
import type { Sushi } from '../src/game/sushi.ts'
const object = (kind: Sushi['type']['kind'] = 'sushi'): Sushi => ({ type: { id: kind, label: kind, kind }, x: 100, y: 100, vx: 0, vy: 0, gravity: 0, radius: 20, angle: 0, spin: 0, age: 0, slice: null, claimed: false })
const view = { width: 1000, height: 800, pixelRatio: 1 }
test('voice accepts the four whole commands with or without Kiri', () => {
  for (const command of ['play','pause','resume','exit'] as const) assert.equal(parseVoice(` Kiri ${command}! `), command)
  for (const command of ['play','pause','resume','exit'] as const) assert.equal(parseVoice(command), command)
  assert.equal(parseVoice('Kiri, pause.'), 'pause')
  for (const text of ['Kiri','Kiri stop','please Kiri play','Kiri play now','Kiri pause Kiri exit']) assert.equal(parseVoice(text), null)
})
test('shared commands are state-aware; separate exits end the session', () => {
  assert.equal(commandDestination('play','start'), 'game')
  assert.equal(commandDestination('play','game'), null)
  assert.equal(commandDestination('resume','game'), null)
  assert.equal(commandDestination('pause','game'), 'pause')
  assert.equal(commandDestination('resume','pause'), 'game')
  assert.equal(commandDestination('exit','game'), 'start')
  assert.equal(commandDestination('exit','start'), 'goodbye')
  assert.equal(commandDestination('exit','goodbye'), null)
})
test('fast crossing swipe cuts once even when both endpoints miss', () => {
  const sushi = object(); const finger = createFingertip(); const swipe = { from: { x: 50, y: 100 }, to: { x: 150, y: 100 } }
  assert.equal(trySliceSushi(sushi,swipe,finger),true)
  assert.equal(trySliceSushi(sushi,swipe,finger),false)
})
test('slow grazing swipe hits at the padded edge but not beyond', () => {
  const finger = createFingertip()
  assert.equal(trySliceSushi(object(), { from: {x:99,y:126}, to: {x:101,y:126} },finger),true)
  assert.equal(trySliceSushi(object(), { from: {x:99,y:127}, to: {x:101,y:127} },finger),false)
})
test('lost tracking, time gaps and implausible jumps cannot form slices', () => {
  const f = createFingertip()
  assert.equal(advanceFingertip(f,{x:0,y:0},10,view),null)
  assert.ok(advanceFingertip(f,{x:10,y:0},30,view))
  resetFingertip(f)
  assert.equal(advanceFingertip(f,{x:100,y:100},40,view),null)
  assert.equal(advanceFingertip(f,{x:110,y:100},400,view),null)
  assert.equal(advanceFingertip(f,{x:999,y:799},401,view),null)
})
test('a HUD crossing is blocked even when endpoints lie outside', () => {
  const rect = { left: 50, top: 50, width: 100, height: 40 }
  assert.equal(segmentIntersectsRect({from:{x:0,y:70},to:{x:200,y:70}},rect),true)
  assert.equal(segmentIntersectsRect({from:{x:0,y:49},to:{x:200,y:49}},rect),false)
})
test('score is claimed once; soy refreshes without stacking and expires', () => {
  const state = createScoreState(gameConfig)
  const cut = (kind: Sushi['type']['kind']) => { const s = object(kind); s.slice = {angle:0,age:0}; return s }
  const sushi = cut('sushi'); applyCut(state,sushi,gameConfig); applyCut(state,sushi,gameConfig)
  assert.equal(state.score,10)
  applyCut(state,cut('soySauce'),gameConfig); updateScoreState(state,2)
  applyCut(state,cut('soySauce'),gameConfig); assert.equal(state.soyRemaining,5)
  applyCut(state,cut('sushi'),gameConfig); assert.equal(state.score,30)
  updateScoreState(state,5); applyCut(state,cut('sushi'),gameConfig); assert.equal(state.score,40)
})
test('wasabi removes one life per object and zero lives block awards', () => {
  const state = createScoreState(gameConfig)
  for(let i=0;i<3;i++) { const s=object('wasabi');s.slice={angle:0,age:0};applyCut(state,s,gameConfig);applyCut(state,s,gameConfig);assert.equal(state.lives,2-i) }
  const sushi=object();sushi.slice={angle:0,age:0};applyCut(state,sushi,gameConfig);assert.equal(state.score,0)
})
test('loop uses real elapsed time for clocks, caps physics, and resumes without a jump', () => {
  let next: FrameRequestCallback | undefined;let requests=0
  globalThis.requestAnimationFrame = cb => { next=cb; return ++requests }
  globalThis.cancelAnimationFrame = () => {next=undefined}
  const steps: number[][]=[];const loop=createGameLoop({update:(physics,elapsed)=>steps.push([physics,elapsed]),render:()=>{}})
  loop.start();loop.start();assert.equal(requests,1)
  next!(100);next!(1100);assert.deepEqual(steps,[[0,0],[0.05,1]])
  loop.stop();assert.equal(next,undefined)
  loop.start();next!(9000);assert.deepEqual(steps.at(-1),[0,0]);loop.stop()
})
test('preferences validate stored values and survive blocked storage', () => {
  let value='{"music":5,"effects":-2,"voice":true,"unlocked":99,"best":{"1":20,"2":-1}}'
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>value,setItem:(_key:string,v:string)=>{value=v}}})
  const result=readPreferences();assert.equal(result.music,1);assert.equal(result.effects,0);assert.equal(result.unlocked,5);assert.deepEqual(result.best,{'1':20})
  assert.equal(savePreferences(result),true)
  value='null';assert.equal(readPreferences().unlocked,1)
  Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw new Error('blocked')}})
  assert.equal(readPreferences().unlocked,1);assert.equal(savePreferences(result),false)
})
test('camera coordinates mirror and crop consistently', () => {
  const rect={left:0,top:0,width:800,height:800}
  assert.deepEqual(mapVideoPointToScreen({x:.5,y:.5},{width:1280,height:720},rect),{x:400,y:400})
  assert.ok(mapVideoPointToScreen({x:.4,y:.5},{width:1280,height:720},rect)!.x>400)
})

test('adaptive smoothing damps stationary jitter while following a fast swipe', async () => {
  const { smoothPoint } = await import('../src/vision/smoothPoint.ts')
  let p = { x: .5, y: .5 }
  let error = 0
  for (let i = 0; i < 120; i++) { p = smoothPoint(p, {x:.5 + (i % 2 ? .002 : -.002), y:.5}, 16.67); error += Math.abs(p.x - .5) }
  assert.ok(error / 120 < .001)
  const fast = smoothPoint({x:.2,y:.5},{x:.4,y:.5},16.67)
  assert.ok(fast.x > .34)
})
test('descent moves objects without changing their score/claim state', async () => {
  const { descendObjects } = await import('../src/game/descent.ts')
  const sushi = object();sushi.gravity=800;sushi.vy=50
  for(let i=0;i<60;i++) descendObjects([sushi],1/60,i/216)
  assert.ok(sushi.y>150);assert.equal(sushi.claimed,false);assert.equal(sushi.slice,null)
})
