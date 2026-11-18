export {step as smooth} from "./batholith.js";
export const duration=40;
export const shots=[
  ["First light",0,7.5],["Through the pines",7.5,12],["The brink",12,17.5],
  ["Wind & water",17.5,23.25],["The impact",23.25,27.75],["River light",27.75,33.5],["Afterglow",33.5,40]
].map(([title,start,end])=>({title,start,end}));
export function shotAt(t){return shots.find(s=>t<s.end)||shots.at(-1);}
