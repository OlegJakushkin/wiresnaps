import {defineConfig,devices} from '@playwright/test';
export default defineConfig({testDir:'tests/browser',timeout:90000,fullyParallel:false,workers:1,reporter:[['list'],['html',{open:'never'}]],use:{baseURL:'http://127.0.0.1:4173',viewport:{width:1440,height:1000},trace:'retain-on-failure',screenshot:'only-on-failure'},webServer:{command:'npm run preview',url:'http://127.0.0.1:4173',reuseExistingServer:false,timeout:30000},projects:[
 {name:'chromium',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:1000},launchOptions:{args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}}},
 {name:'firefox',use:{...devices['Desktop Firefox'],viewport:{width:1440,height:1000},headless:false,launchOptions:{firefoxUserPrefs:{'webgl.force-enabled':true,'webgl.disabled':false}}}},
 {name:'webkit',use:{...devices['Desktop Safari'],viewport:{width:1440,height:1000}}},
]});
