import { getObjectsByPrototype, getTicks } from 'game/utils';
import {Creep} from "game/prototypes"
import { ERR_NOT_IN_RANGE } from 'game/constants';
import { Flag } from 'arena/prototypes';

type RoleManagerSettings<Obj,Role extends string> = {
    source: () => Obj[];
    assign: (obj: Obj,getAssignedNumber: (role:Role) => number) => Role;
}

type RoleManager<Obj,Role extends string> = {
    get(role: Role): Obj[]
}

const throwError: (msg: string) => never = (msg) => {throw new Error(msg)};

const roleManager = <Obj,Role extends string>(settings: RoleManagerSettings<Obj,Role>): RoleManager<Obj,Role> => {
    let record : Record<string,Obj[]> = {};
    return {
        get(roleArg: Role): Obj[] {
            const registered = record[roleArg];
            if(registered){
                return registered;
            }
            const objs = settings.source();
            for (const obj of objs) {
                const role = settings.assign(obj,(role) => {
                    const registered = record[role];
                    if(registered){
                        return registered.length;
                    }
                    return 0;
                });
                const registered = record[role];
                registered ? registered.push(obj) : (record[role] = [obj]);
            }
            return record[roleArg] || [];
        }
    }
}

type Role =  "attacker" | "defender" | "chaser" | "defenderHealer" | "attackerHealer" | "chaserHealer"
const roles : RoleManager<Creep,Role>  = roleManager<Creep,Role>({
    source: function () {
        return getObjectsByPrototype(Creep).filter(creep => creep.my)
    },
    assign: function (obj: Creep,getNumber): Role {
        if(obj.body.some(part => part.type == "attack")){
            return "attacker"
        }
        if(obj.body.some(part => part.type == "ranged_attack")){
            if(getNumber("defender") < 1){
                return "defender";
            }
            return "chaser"
        }
        if(obj.body.some(part => part.type == "heal")){
            if(getNumber("attackerHealer") < 2) {
                return "attackerHealer"
            } 
            if(getNumber("defenderHealer") < 2) {
                return "defenderHealer"
            }
            return "chaserHealer"
        }
        throwError("assign failed");
    },
});

type Focus = {
    getCurrent(): Creep | null;
}

const createFocusContainer = (): Focus => {
    let currentFocus: [Creep ,number] | null = null;
    return {
        getCurrent: () => {
            const currentTick = getTicks();
            if(!currentFocus || currentTick - currentFocus[1] > 10){
                const enemies = getObjectsByPrototype(Creep).filter(creep => !creep.my)
                const myflg = getObjectsByPrototype(Flag).find(f => f.my);
                if(!myflg) throw new Error("no flag");
                const closest = myflg.findClosestByPath(enemies)
                if(closest){
                    currentFocus = [closest,currentTick]
                    return closest;
                } else {
                    return null
                }
            } 
            return currentFocus[0];
        },
    }
}

const focusContainer = createFocusContainer()

export function loop() {
    const myflg = getObjectsByPrototype(Flag).find(f => f.my);
    if(!myflg) throw new Error("no flag");
    
    const attackers = roles.get("attacker");
    const healers = {
        forChaser: roles.get("chaserHealer"),
        forDefence: roles.get("defenderHealer"),
        forAttacker: roles.get("attackerHealer")
    }
    const defender = roles.get("defender");
    const chaisers = roles.get("chaser");
    const enemies = getObjectsByPrototype(Creep).filter(creep => !creep.my)
    const focus = focusContainer.getCurrent();
    if(focus) {
        const bindedFocus = focus;
        chaisers.forEach(attacker => {
            if(attacker.rangedAttack(bindedFocus) == ERR_NOT_IN_RANGE){
                attacker.moveTo(bindedFocus);
            }
        })
        const damagedChaser = getMostDamaged(chaisers);
        healers.forChaser.forEach(healer => {
            if(damagedChaser){
                healOrMove({healer,target: damagedChaser});
            } else {
                healer.moveTo(myflg);
            }
        })
    } 
    defender.forEach(def => {
        const closestEnemy = def.findClosestByPath(enemies);
        if(closestEnemy && def.rangedAttack(closestEnemy) == ERR_NOT_IN_RANGE){
            def.moveTo(myflg);
        }
    })
    healers.forDefence.forEach(healer => {
        const closestDefender = healer.findClosestByPath(defender);
        if(closestDefender){
            healOrMove({healer,target: closestDefender});
        } else {
            healer.moveTo(myflg);
        }
    })
    const flg = getObjectsByPrototype(Flag).find(f => !f.my);
    if(!flg) throw new Error("no flag");
    attackers.forEach(creep => {
        const closestEnemy = creep.findClosestByPath(enemies);
        if(!closestEnemy || creep.attack(closestEnemy) == ERR_NOT_IN_RANGE){
            creep.moveTo(flg);
        }
    })
    const damagedAttacker = getMostDamaged(attackers);
    healers.forAttacker.forEach(healer => {
        if(damagedAttacker){
            healOrMove({
                healer: healer,
                target: damagedAttacker,
            });
        } else {
            const closest = healer.findClosestByPath(attackers);
            if(closest){
                healer.moveTo(closest);
            } else {
                healer.moveTo(flg);
            }
        }
        
    })
}

const healOrMove = ({healer,target}:{healer: Creep,target: Creep}) => {
    if(healer.heal(target) === ERR_NOT_IN_RANGE && healer.rangedHeal(target) === ERR_NOT_IN_RANGE){
        healer.moveTo(target);
    }
}

const getMostDamaged = (creeps: Creep[]): Creep | null => {
    return creeps.filter(creep => (creep.hitsMax - creep.hits)).reduce<Creep | null>((acc, creep) => {
        if(!acc){
            return creep;
        }
        if((creep.hitsMax - creep.hits) > (acc.hitsMax - acc.hits)){
            return creep;
        }
        return acc;
    },null)
}