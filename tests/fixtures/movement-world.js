import { box, ramp } from '../../src/physics.js';
export function createWorld() {
  const solids=[
    box(0,990,190,800,50,660,0x3e5057),
    ramp(0,-150,1320,330,940,210,0x2c7778),
    ramp(-180,-1610,1060,300,730,220,0x416d87),
    ramp(60,-2810,740,280,470,150,0x2c7778),
    box(0,-230,-3780,1100,70,560,0x3e5057),
    box(1700,0,0,1600,40,2000,0x3d5057),
  ];
  // Bunny-hop islands and a low ceiling for checking the actual crouched hull.
  for(let i=0;i<6;i++)solids.push(box(1250+(i%2)*170,40,-320-i*235,150,32,140,0x607782));
  solids.push(box(1980,40,-420,30,125,360,0x526871),box(2340,40,-420,30,125,360,0x526871),box(2160,86,-420,390,30,360,0x627783));
  for(let i=0;i<5;i++)solids.push(box(1970,40+i*16,240-i*80,300,16,80,0x587078));
  solids.push(box(1970,120,-140,300,24,120,0x587078));
  // Climb tower on the practice yard; the front ladder reaches its roof.
  solids.push(box(1700,40,80,240,320,300,0x4a6470));
  // Pool beside the yard, floor at -200 and a surface below the 40-unit deck.
  solids.push(box(3060,-230,-200,1120,30,1440,0x254854));
  solids.push(box(2560,-200,-200,120,240,1440,0x496571),box(3560,-200,-200,120,240,1440,0x496571));
  solids.push(box(3060,-200,460,880,240,120,0x496571),box(3060,-200,-860,880,240,120,0x496571));
  // Broad submerged stairs provide a second exit, in addition to the pool ladder.
  for(let i=0;i<15;i++)solids.push(box(2810,-200,380-i*40,300,240-i*16,40,0x557e89));
  const ladders=[
    {min:{x:1650,y:40,z:230},max:{x:1750,y:368,z:242},normal:{x:0,y:0,z:1},top:360},
    {min:{x:2620,y:-200,z:-540},max:{x:2632,y:48,z:-440},normal:{x:1,y:0,z:0},top:40},
  ];
  const waters=[{min:{x:2620,y:-200,z:-800},max:{x:3500,y:16,z:400}}];
  // One continuous course: strafe -> bhop -> duck -> double-duck -> water
  // -> ladder -> the original three surf ramps -> the finish portal.
  solids.push(box(0,720,3140,800,40,640,0x3d5057));
  for(let i=0;i<3;i++)solids.push(box(i%2?55:-55,720,2660-i*200,200,40,120,0x547b85));
  solids.push(box(0,552,1940,800,208,600,0x3d5057));
  solids.push(box(-135,760,2010,30,100,240,0x607782),box(135,760,2010,30,100,240,0x607782),box(0,806,2010,300,30,240,0x627783));
  solids.push(box(0,760,1750,300,24,24,0x97a963));
  // Pool is recessed into the route. Its far ladder is also the ascent to surf.
  solids.push(box(0,520,1295,800,32,690,0x254854));
  solids.push(box(-380,552,1295,40,208,690,0x496571),box(380,552,1295,40,208,690,0x496571));
  solids.push(box(0,552,740,800,488,420,0x496571));
  solids.push(box(0,990,525,800,50,30,0x496571));
  waters.push({min:{x:-360,y:552,z:950},max:{x:360,y:752,z:1640}});
  ladders.push({min:{x:-65,y:552,z:950},max:{x:65,y:1048,z:964},normal:{x:0,y:0,z:1},top:1040});
  return {solids,ladders,waters,courseSpawn:{x:0,y:760.03,z:3310},ladderSpawn:{x:1700,y:40.03,z:350},waterSpawn:{x:3070,y:40.03,z:470},spawn:{x:120,y:1040.03,z:330},practice:{x:1700,y:40.03,z:650},portal:{min:{x:-470,y:-160,z:-4000},max:{x:470,y:65,z:-3730}},killY:-450};
}
export function inPortal(p,portal){return ['x','y','z'].every(k=>p[k]>=portal.min[k]&&p[k]<=portal.max[k]);}
