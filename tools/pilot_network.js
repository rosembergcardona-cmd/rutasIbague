// Pilot sample network for the prototype. Coordinates are APPROXIMATE and the
// routes are ILLUSTRATIVE (not the official company routes); they will be
// replaced by field-verified data in the next phase.
var NETWORK = {
 stops: [
  ["S01","Plaza de Bolívar (Centro)",4.4447,-75.2424],
  ["S02","La Pola",4.4465,-75.2385],
  ["S03","Belén",4.4490,-75.2350],
  ["S04","Calambeo",4.4560,-75.2380],
  ["S05","Terminal de Transportes",4.4385,-75.2365],
  ["S06","Parque Centenario",4.4410,-75.2330],
  ["S07","Hospital Federico Lleras",4.4370,-75.2290],
  ["S08","Ricaurte",4.4310,-75.2470],
  ["S09","Boquerón",4.4225,-75.2560],
  ["S10","Universidad del Tolima",4.4285,-75.2140],
  ["S11","Estadio Murillo Toro",4.4335,-75.2185],
  ["S12","Calle 37 – Av. Quinta",4.4405,-75.2240],
  ["S13","Calle 42 – Av. Quinta",4.4415,-75.2170],
  ["S14","Av. Ambalá – Calle 42",4.4475,-75.2200],
  ["S15","Universidad de Ibagué",4.4510,-75.2010],
  ["S16","C.C. La Estación (Calle 60)",4.4425,-75.2050],
  ["S17","Multicentro",4.4440,-75.1990],
  ["S18","Av. Guabinal",4.4360,-75.2080],
  ["S19","Acqua Power Center",4.4470,-75.1930],
  ["S20","Jordán",4.4430,-75.1870],
  ["S21","El Salado",4.4690,-75.1720],
  ["S22","Calle 80 – Av. Mirolindo",4.4340,-75.1830],
  ["S23","Mirolindo",4.4270,-75.1700],
  ["S24","Picaleña",4.4120,-75.1520],
  ["S25","Aeropuerto Perales",4.4220,-75.1335],
  ["S26","Ambalá",4.4580,-75.1950],
  ["S27","Cádiz",4.4380,-75.2120],
  ["S28","Varsovia",4.4420,-75.1780]
 ],
 routes: [
  {id:"R1",name:"Ruta 1 · Centro – Picaleña",color:"#1f6feb",headway:8,stops:["S01","S06","S12","S13","S16","S22","S23","S24"]},
  {id:"R2",name:"Ruta 2 · Centro – El Salado",color:"#d1495b",headway:10,stops:["S01","S02","S03","S14","S15","S26","S21"]},
  {id:"R3",name:"Ruta 3 · Terminal – Jordán",color:"#2a9d8f",headway:12,stops:["S05","S07","S11","S10","S27","S18","S17","S20"]},
  {id:"R4",name:"Ruta 4 · Ricaurte – Aeropuerto",color:"#e09f3e",headway:20,stops:["S08","S01","S05","S07","S13","S18","S22","S23","S25"]},
  {id:"R5",name:"Ruta 5 · Calambeo – Terminal",color:"#7b2cbf",headway:15,stops:["S04","S03","S02","S01","S06","S05"]},
  {id:"R6",name:"Ruta 6 · Boquerón – Unibagué",color:"#6a994e",headway:15,stops:["S09","S08","S07","S11","S27","S16","S15"]},
  {id:"R7",name:"Ruta 7 · El Salado – Picaleña",color:"#bc6c25",headway:12,stops:["S21","S19","S20","S28","S23","S24"]},
  {id:"R8",name:"Ruta 8 · Calambeo – Jordán",color:"#457b9d",headway:15,stops:["S04","S03","S14","S13","S16","S17","S19","S20"]}
 ]
};
if (typeof module!=="undefined") module.exports = NETWORK;
