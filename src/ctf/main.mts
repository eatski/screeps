import { getObjectsByPrototype } from 'game/utils';
import {Creep} from "game/prototypes"
import { ERR_NOT_IN_RANGE } from 'game/constants';
import { Flag } from 'arena/prototypes';

let focus : Creep | null = null;
let defence : Creep | null = null;
let reducedHeelers : Record<"forChaser" | "forDefence" | "forAttacker", Creep[]> | null = null; 
export function loop() {
    console.log("Victry");
    const myflg = getObjectsByPrototype(Flag).find(f => f.my);
    if(!myflg) throw new Error("no flag");
    const creeps = getObjectsByPrototype(Creep).filter(creep => creep.my);
    const attackers = creeps.filter(creep => creep.body.some(e => e.type === "attack"));
    const rangeAttackers = creeps.filter(creep => creep.body.some(e => e.type === "ranged_attack"));
    const heelers = creeps.filter(creep => creep.body.some(e => e.type === "heal"));
    if(!reducedHeelers){
        reducedHeelers = {
            forChaser: [],
            forDefence: [],
            forAttacker: []
        };
        const binded = reducedHeelers;
        heelers.forEach(healer => {
            if(binded.forAttacker.length < 2){
                binded.forAttacker.push(healer);
            } else if(binded.forChaser.length < 2){
                binded.forChaser.push(healer);
            } else {
                binded.forDefence.push(healer);
            }
        })
    }
    if(!defence){
        defence = rangeAttackers[0] || null
    }
    const chaisers = rangeAttackers.filter(creep => !defence || (creep.id !== defence.id));
    console.log("chaisers",chaisers.map(c => c.id));
    const enemies = getObjectsByPrototype(Creep).filter(creep => !creep.my)
    if(!focus || !focus.exists){
        const closest = myflg.findClosestByPath(enemies,{
            range: 300
        });
        focus = closest;
        
       
    }
    if(focus) {
        const bindedFocus = focus;
        chaisers.forEach(attacker => {
            if(attacker.rangedAttack(bindedFocus) == ERR_NOT_IN_RANGE){
                attacker.moveTo(bindedFocus);
            }
        })
        const damagedChaser = getMostDamaged(chaisers);
        if(chaisers && damagedChaser){
            reducedHeelers.forChaser.forEach(healer => {
                if(healer.heal(damagedChaser) === ERR_NOT_IN_RANGE){
                    healer.moveTo(damagedChaser);
                }
            })
        }
    } 
    if(defence){
        const bindedDefence = defence;
        bindedDefence.moveTo(myflg);
        if(reducedHeelers){
            reducedHeelers.forDefence.forEach(healer => {
                if(healer.heal(bindedDefence) == ERR_NOT_IN_RANGE){
                    healer.moveTo(bindedDefence);
                }
            })
        }
    }
    const flg = getObjectsByPrototype(Flag).find(f => !f.my);
    if(!flg) throw new Error("no flag");
    attackers.forEach(creep => {
        creep.moveTo(flg);
    })
    const damagedAttacker = getMostDamaged(attackers);
    if(damagedAttacker && reducedHeelers){
        reducedHeelers.forAttacker.forEach(healer => {
            if(healer.heal(damagedAttacker) === ERR_NOT_IN_RANGE){
                healer.moveTo(damagedAttacker);
            }
        })
    }
}

const getMostDamaged = (creeps: Creep[]): Creep | null => {
    return creeps.reduce<Creep | null>((acc, creep) => {
        if(!acc){
            return creep;
        }
        if((creep.hitsMax - creep.hits) > (acc.hitsMax - acc.hits)){
            return creep;
        }
        return acc;
    },null)
}