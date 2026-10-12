import {tr} from '../i18n/index.js';
// Exploration regions. Each region has a fixed manifest of collectibles; the AI game master decides HOW and WHERE
// the kid finds them (different every run), but can only award what is listed here.
export const REGIONS = [
  {
    id: 'harbor', name: tr("新手港湾"), en: 'Harbor Bay', order: 1, color: '#29b6ff',
    landform: tr("海岸与港口"),
    geoTopics: [tr("潮汐与月球引力"), tr("东南西北与指南针"), tr("看懂地图（比例尺、图例）"), tr("海岸地貌：沙滩、礁石、海湾"), tr("灯塔与航海")],
    scenery: 'a sunny seaside harbour town: red-roofed houses, wooden piers, fishing boats, a white lighthouse on rocks, tide pools, a sandy cove, a small grassy practice stadium, gulls',
    beys: ['fish', 'goatpuff', 'ninjamight'],
    bladers: ['ran', 'tetsu', 'hop'],
    recruitable: [],
    unlock: null,
  },
  {
    id: 'thunder', name: tr("雷霆山脉"), en: 'Thunder Range', order: 2, color: '#2f7bff',
    landform: tr("高山与冰川"),
    geoTopics: [tr("海拔越高越冷（约每升高 100 米降 0.6°C）"), tr("雷暴是怎么形成的"), tr("雪线与冰川"), tr("等高线地图"), tr("迎风坡和背风坡的降雨")],
    scenery: 'dramatic mountains: switchback trails, a blue spiral lightning tower on a cliff, a frozen glacier lake with cyan ice crystals, a grey iron fortress with gears, storm clouds over peaks, pine forests below the snow line',
    beys: ['titan'],
    bladers: ['raiga', 'hyomi', 'iwaki'],
    recruitable: ['raiga', 'hyomi', 'iwaki'],
    unlock: {beys: 3, label: tr("收集 3 只陀螺解锁")},
  },
  {
    id: 'volcano', name: tr("龙焰火山岛"), en: 'Dragon Volcano Isle', order: 3, color: '#ff2d4a',
    landform: tr("火山与板块"),
    geoTopics: [tr("火山是怎么形成的"), tr("地球的板块"), tr("温泉与地热"), tr("岩浆和熔岩的区别")],
    scenery: 'a volcanic island: smoking volcano, black lava rock fields, steaming hot springs, a purple bamboo ninja temple, a futuristic observatory, a red-black dragon castle under storm clouds',
    beys: ['bossdragoon'],
    bladers: ['shadow', 'blaze', 'nova', 'ryuoh'],
    recruitable: [],
    unlock: {team: 3, label: tr("队伍里有 3 名队员解锁")},
    comingSoon: true,
  },
];

export const regionById = id => REGIONS.find(r => r.id === id);

export function regionUnlocked(region, save) {
  if (save.demo || !region.unlock) return true;
  if (region.unlock.beys) return save.collection.length >= region.unlock.beys;
  if (region.unlock.team) return save.team.length >= region.unlock.team;
  return true;
}

// Per-region progress lives in save.explore[regionId] = {found:[beyIds], met:[bladerIds], steps, runs, gm:{...free-form GM memory}}
export const emptyExplore = () => ({found: [], met: [], steps: 0, runs: 0, gm: null});
