import { getObjectsByPrototype } from 'game/utils';
import {Creep,StructureSpawn} from "game/prototypes"
import { ERR_NOT_IN_RANGE } from 'game/constants';

export function loop() {
    const creep = getObjectsByPrototype(Creep).filter(creep => creep.my);
    const enemies = getObjectsByPrototype(Creep).filter(creep => !creep.my);
    const spawn = getObjectsByPrototype(StructureSpawn).find(s => s.my);
    
    if(!spawn){
        throw new Error("no spawn");
    }
    spawn.spawnCreep(["move","attack"]);
    creep.forEach(creep => {
        const enemy = creep.findClosestByPath(enemies);
        if(enemy){
            if(creep.attack(enemy) == ERR_NOT_IN_RANGE){
                creep.moveTo(enemy);
            }
        }
    })
}