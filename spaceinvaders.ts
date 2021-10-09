// FIT2102 Assignment 1
// By: Kim Yen Pham 
// ID: 31499414

import { fromEvent, interval, merge} from 'rxjs'; 
import { map, filter, scan} from 'rxjs/operators';

// The types of keys that the game will use
type Key = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'Space' | 'Enter'
type Event = 'keydown' | 'keyup'

function spaceinvaders() {

  // (Original comment from base code)
  // Inside this function you will use the classes and functions 
  // from rx.js
  // to add visuals to the svg element in pong.html, animate them, and make them interactive.
  // Study and complete the tasks in observable exampels first to get ideas.
  // Course Notes showing Asteroids in FRP: https://tgdwyer.github.io/asteroids/ 
  // You will be marked on your functional programming style
  // as well as the functionality that you implement.
  // Document your code!


  // A function that holds all functionality for the FRP implementation of the classic 
  // arcade game, Space Invaders.

  // Derived from the asteroids example code by Tim Dywer from https://tgdwyer.github.io/asteroids/


  // Constant to hold commonly used magic numbers
  const 
  Constants = {
    CanvasSize: 600,
    StartTime: 0,

    BulletExpirationTime: 0.29,
    BulletRadius: 3,
    BulletVelocity: 3,

    AlienVelocity: 0.2,
    AlienRadius: 12.5,
    StartAliensCount: 11*5,

    ShieldSize:40
  } as const


  // Derived from the asteroids example code by Tim Dywer from https://tgdwyer.github.io/asteroids/
  type ViewType = 'ship' | 'alien' | 'bullet' | 'shield' // our game has the following view element types
  type Interval_RND = Readonly<{elapsed:number, rand:number}> // a new data type to hold both times and random numbers


  // Derived from the asteroids example code by Tim Dywer from https://tgdwyer.github.io/asteroids/
  // Four types of game state transitions:
  class Tick_rnd { constructor(public readonly elapsed_rnd:Interval_RND) {}} // changed to hold both interval times and random numbers
  // two separate states to hold left and right arrow down - this way we can check what to do if one/both arrow keys are pressed down/released
  class LeftMove { constructor(public readonly leftDown:boolean) {} } // check if left arrow is pressed
  class RightMove { constructor(public readonly rightDown:boolean) {} } // check if right arrow is pressed
  class Shoot { constructor() {} }
  


  /***
   * Random Number Generator class.
   * Allows for the creation of streams of random numbers.
   * 
   * From Pi Approximations FRP Solution by Tim Dwyer at https://www.youtube.com/watch?v=RD9v9XHA4x4&ab_channel=TimDwyer
   */
  class RNG {
    // LCG using GCC's constants
    readonly m = 0x80000000// 2**31
    readonly a = 1103515245
    readonly c = 12345

    constructor(readonly state) {}

    int() {
      return (this.a * this.state + this.c) % this.m;
    }
    float() {
      // returns in range [0,1]
      return this.int() / (this.m - 1);
    }
    next() {
      // create a new RNG using the current int as the new seed
      return new RNG(this.int())
    }
  }

  /**
   * Creates a new stream of random numbers based on the input seed used.
   * 
   * From Pi Approximations FRP Solution by Tim Dwyer at https://www.youtube.com/watch?v=RD9v9XHA4x4&ab_channel=TimDwyer
   * 
   * @param seed number representing the input seed that the random number stream is based on
   * @returns Observable. A stream of random numbers
   */
  const randomNumberStream = seed => interval(300).pipe( // the number used for the interval can be adjusted. Lower intervals = more aliens shooting at once.
    // scan takes in an acc (r) and the incoming value in the seq, and returns next value for that acc.
    // r = acc, _ = the numbers that we'll replace with random numbers
    scan((r,_) => r.next(), new RNG(seed)), // produces stream of RNGs
    map(r => Constants.StartAliensCount*r.float()) // multiplying RNG by the number of aliens makes the range 0 to 55 (it prev used to be 0 to 1)
  );



  const randomNum$ = randomNumberStream(1) // the random number stream used in the game. Generates numbers form 0-55.

  /**
   * The Observable handling the game's ticks.
   * Allows for the game to make changes every 10ms.
   * 
   * Derived from the asteroids example code by Tim Dywer from https://tgdwyer.github.io/asteroids/
   */
  const 
    gameClock = merge(interval(10), randomNum$) // merges the interval and random number stream together
                                                // merging will create a new stream so that a random number is allocated for most intervals
                                                // this is done so that for any certain interval, aliens have access to a random number, used
                                                // to determine if an alien can shoot at that particular time
                .pipe(map((rand:number, elapsed:number) => // since there are more intervals than random numbers (due to differences in interval times)
                                                          // when a random number is not generated, an interval is put in its place instead
                                                          // we filter out these intervals by replacing them with null.
                            rand % 1 != 0 ? new Tick_rnd({elapsed, rand}) // if the "random number" is a whole number, then it is most likely just an interval and not a random number
                            : new Tick_rnd({elapsed, rand:null}))), // replace invalid random numbers with null
   

    /**
     * Observable for key events. Checks if a key is down/up.
     * 
     * From the asteroids example code by Tim Dywer from https://tgdwyer.github.io/asteroids/
     */
    keyObservable = <T>(e:Event, k:Key, result:()=>T)=>
      fromEvent<KeyboardEvent>(document,e)
        .pipe(
          filter(({code})=>code === k),
          filter(({repeat})=>!repeat), // filter out repeating keys - for some OSs, if a key is held down, they may start repeating
          map(result)),

    
  // Observable for key events.
  // Used in the main game's subscription, allows the player to perform actions (movement and shooting) on the ship
  // Derived from the asteroids example code by Tim Dywer from https://tgdwyer.github.io/asteroids/
  startLeftMove = keyObservable('keydown','ArrowLeft',()=>new LeftMove(true)),
  stopLeftMove = keyObservable('keyup','ArrowLeft',()=>new LeftMove(false)),
  startRightMove = keyObservable('keydown','ArrowRight',()=>new RightMove(true)),
  stopRightMove = keyObservable('keyup','ArrowRight',()=>new RightMove(false)),
  shoot = keyObservable('keydown','Space', ()=>new Shoot())


  
  // Creating types and interfaces
  // Derived from the asteroids example code by Tim Dywer from https://tgdwyer.github.io/asteroids/

  type Circle = Readonly<{pos:Vec, radius:number}>
  type ObjectId = Readonly<{id:string,createTime:number}>
  
  // all objects in the game currently extend from this interface
  interface IBody extends Circle, ObjectId {
    readonly viewType: ViewType,
    readonly vel:Vec,
    readonly colour: string,
    readonly belongsTo: string
  }
  interface Alien extends IBody {
    readonly pointsWorth:number
  }
  interface Ship extends IBody{
   readonly leftMove:boolean,
    readonly rightMove:boolean
  }
  interface Shield extends IBody{
    readonly viewType: ViewType,
    readonly colour: string,
    readonly health: number
  }

  // Every object that participates is a Body
  type Body = Readonly<IBody|Alien|Ship|Shield>

  // Game state
  type State = Readonly<{
    ship:Ship,
    bullets:ReadonlyArray<Body>,
    aliens:ReadonlyArray<Body>,
    shields:ReadonlyArray<Body>

    exit:ReadonlyArray<Body>,

    objCount:number,

    gameOver:boolean,
    gameWin: boolean,

    time:number,
    points: number
  }>


  // Functions to create objects in the game

  /**
   * Function to create a circle. Currently used to create bullets.
   * Derived from the asteroids example code by Tim Dywer from https://tgdwyer.github.io/asteroids/
   */
  const createCircle = (viewType: ViewType)=> (oid:ObjectId)=> (circ:Circle)=> (vel:Vec) => (parent: string) => (colour:string) =>
    <Body>{
      ...oid,
      ...circ,
      vel:vel,
      id: viewType+oid.id,
      viewType: viewType,
      belongsTo: parent,
      colour: colour
    },
    createBullet = createCircle('bullet')

  /**
   * Function to create an alien.
   * New function derived from the asteroids example code by Tim Dywer from https://tgdwyer.github.io/asteroids/
   */
    const createAlien = (oid:ObjectId)=> (circ:Circle)=> (vel:Vec) => (points:number, colour:string) =>
    <Alien>{
      ...oid,
      ...circ,
      vel:vel,
      id: 'alien'+oid.id,
      viewType: 'alien',

      pointsWorth: points,
      colour: colour
    }

  /**
   * Function to create the ship.
   * Derived from the asteroids example code by Tim Dywer from https://tgdwyer.github.io/asteroids/
   */
  function createShip():Ship {
    return {
      id: 'ship',
      viewType: 'ship',
      pos: new Vec(Constants.CanvasSize/2,Constants.CanvasSize/8*7) ,
      vel: Vec.Zero,
      radius:20,
      createTime:0,
      leftMove: false,
      rightMove: false,
      colour: 'white',
      belongsTo: 'ship'
    }
  }

  /**
   * Function to create a Shield.
   * New function derived from the asteroids example code by Tim Dywer from https://tgdwyer.github.io/asteroids/
   */
  const createShield = (oid:ObjectId) => (circ:Circle) => (health:number, colour:string) => 
    <Shield>{
      ...oid,
      ...circ,
      viewType: 'shield',
      vel: Vec.Zero,
      id: 'shield'+oid.id,
      belongsTo:'shield',
      health: health,
      colour: colour
  }


  // Functions to initialise the game by creating the starting objects

  /**
   * Creates the starting Shields at the beginning of the game.
   * New function derived from the asteroids example code by Tim Dywer from https://tgdwyer.github.io/asteroids/
   * 
   * @returns the array of starting Shields
   */
  const startShields = [...Array(4)].map((_,i)=>{
    return createShield({id:String(i),createTime:Constants.StartTime})
    ({pos: new Vec(i*Constants.ShieldSize*4+Constants.ShieldSize*1.5, Constants.CanvasSize/9*7),
      radius:Constants.ShieldSize})
      (10,"lawngreen")
      
  })

  /**
   * Creates the starting Aliens at the beginning of the game.
   * New function derived from the asteroids example code by Tim Dywer from https://tgdwyer.github.io/asteroids/
   * 
   * @returns the array of starting Aliens
   */
  const
    startAliens = [...Array(Constants.StartAliensCount)]
      .map((_,i)=>{

      const mod = (i:number) => i%5;

      // determines the alien's points based on its row position
      // first row = 30 points, second and third row = 20 points, bottom two rows = 10 points
      const alienPoint= (i:number) => 
        mod(i) == 0 ? 30 :
        mod(i) <= 2 ? 20 :
        10;

      // determines the alien's colour based on the number of points it's worth
      const determineAlienColour = (point:number) =>
        point == 30 ? "orange" :
        point == 20 ? "yellow" :
        "white";
    
      return createAlien({id:String(i),createTime:Constants.StartTime})
                          // creates 5 rows, 11 columns of aliens. Each alien is created column by column, going from top to bottom, left to right.
                        ({pos: new Vec((Constants.CanvasSize + i*10 -(i%5)*10)+Constants.AlienRadius, Constants.CanvasSize/9 + i%5*40),
                          radius:Constants.AlienRadius})
                        (Vec.unitVecInDirection(90).scale(Constants.AlienVelocity)) // initially moving from left to right
                        (alienPoint(i), determineAlienColour(alienPoint(i)))
      }),


  // The starting game state
  // Derived from the asteroids example code by Tim Dywer from https://tgdwyer.github.io/asteroids/
  initialState:State = {
    ship: createShip(),
    bullets: [],
    aliens: startAliens,
    shields: startShields,

    exit: [],

    objCount: Constants.StartAliensCount,

    gameOver: false,
    gameWin: false,

    time:0,
    points: 0
    
  }

    
/**
 * Function to wrap position around left/right edges of screen
 * Derived from the asteroids example code by Tim Dywer from https://tgdwyer.github.io/asteroids/
 */
const
  torusWrap = ({x,y}:Vec) => { 
    const s=Constants.CanvasSize, 
      wrap = (v:number) => v < 0 ? v + s : v > s ? v - s : v;
    return new Vec(wrap(x),y) // only wrap for left/right sides. top/bottom sides are not wrapped to prevent bullets from going to other side of screen.
  },

  newMovement = (angle:number, speed:number) => Vec.unitVecInDirection(angle).scale(speed),

  /**
   * Provides movement for Ships only.
   * If left key pressed, move left and vice versa. If both or no keys are pressed, the Ship will not move.
   * @param o the Ship that will be moved
   */
  moveShip = (o:Ship) => 
    <Ship>{
      ...o,
      pos:torusWrap(o.pos.add(o.vel)),
      vel: o.leftMove && !o.rightMove ? newMovement(-90,2) :
          !o.leftMove && o.rightMove ? newMovement(90,2) : 
          Vec.Zero,
    },
  
  /**
   * Provides movement for all moving objects (excluding Ships).
   * Derived from the asteroids example code by Tim Dywer from https://tgdwyer.github.io/asteroids/
   * @param o the Body that will be moved
   */
  moveBody = (o:Body) => <Body>{
    ...o,
    pos:torusWrap(o.pos.add(o.vel))
  }


  /**
   * Determines if an alien should shoot or not, and creates a bullet if they do shoot.
   * 
   * @param s the current state
   * @param elapsed the current interval and rnadom number associated with it
   * @returns new game State
   */
  const 
    handleAlienShooting = (s:State, elapsed:Interval_RND) => {

    // Determines if an alien should shoot or not
    // if the random number generated for this current state matches the alien's index, it will shoot.
    const
      shouldAlienShoot = (i:number, rand:number) => rand != null ? Math.ceil(rand) == i : false,
      
      shootingAliens = s.aliens.filter((_:Alien, i:number)=> shouldAlienShoot(i, elapsed.rand)),

      // creates a new enemy bullet for every shooting alien
      newBullets = shootingAliens.map((r,i)=> createBullet({id:String(s.objCount+i),createTime:s.time})
                                ({radius:Constants.BulletRadius,pos:r.pos})
                                (Vec.unitVecInDirection(180).scale(Constants.BulletVelocity))
                                ('alien')('white'));

    return {
      ...s,
      bullets:s.bullets.concat(newBullets).map(moveBody),
      objCount: s.objCount + newBullets.length
    }
  }

  /**
   * Returns all elements in array a except for those in array b.
   * From the asteroids example code by Tim Dywer from https://tgdwyer.github.io/asteroids/
   * 
   * @param a array to be filtered
   * @param b array of elements to be filtered out of a
   */
  const cut = except((a:Body)=>(b:Body)=>a.id === b.id)
 
  /**
   * Changes the direction of the aliens.
   * It does this by replacing every alien with new ones that move in a new direction.
   * Derived from the asteroids example code by Tim Dywer from https://tgdwyer.github.io/asteroids/
   * 
   * @param s the current State
   * @param aliensToRespawn the aliens that should change direction
   * @returns the new game state
   */
  const handleAlienPath = (s:State, aliensToRespawn:Body[]) => {
    // function to create the new alien that will replace the other after a certain point in time
    const
      alien = (r:Alien,dir:number)=>
        ({
          ...r,
          pos:r.pos.add(new Vec(0,20)), // after the interval, move down (discrete)
          vel: r.vel.rotate(180).scale(-(dir)), // move in the opposite direction that it was going previously (continuous)
        }),
      spawnAlien = (r:Alien)=> [alien(r,-1)],
      
      // creates new aliens with same properties except for id and createTime
      newAliens = flatMap(aliensToRespawn, spawnAlien).map((r,i) => 
          createAlien({id:String(s.objCount + i),createTime:s.time})
                      ({pos:r.pos, radius:r.radius})
                      (r.vel)
                      (r.pointsWorth, r.colour)
        )

    return <State>{
      ...s,
      aliens: cut(s.aliens.concat(newAliens))(aliensToRespawn), // add newAliens but exclude the aliens it replaced
      exit: s.exit.concat(aliensToRespawn),
      objCount: s.objCount + newAliens.length,
    }
  }
    

  /**
   * Gets the total number of points an array of aliens has altogether
   * 
   * @param collidedAliens the array of Aliens to sum up points
   * @returns the sum of points the array of aliens has altogether
   */
  const getHitAlienPoints = (collidedAliens:Body[]):number => {
    const
      getAlienPoints = (a: Alien):number => a.pointsWorth,
      collidedAlienPoints = collidedAliens.length > 0 ? // if there are any aliens in the list
                                  collidedAliens.map<number>(getAlienPoints) // replace with point value
                            : [0]
    return collidedAlienPoints.reduce((acc,curr)=> acc+curr) // return sum of all points
  }
    
  /**
   * Replaces shields in given array with another shield with a lower health, changing it's
   * colour if necessary.
   * 
   * @param state the current game state
   * @param shieldsToReplace the Shields that should be changed with another lower health Shield
   * @returns array of valid new Shields with one less health (New Shields with a new health of 0 are not returned)
   */
  const changeHitShields = (state:State, shieldsToReplace:Body[]):Shield[] => {
    // changes colour based on the health of the shield
    const
      determineShieldColour = (health:number) =>
      health > 8 ? "limegreen" :
      health > 5 ? "green" :
      health > 2 ? "darkgreen" :
      "darkslategrey",

      // recreate the same shield but with lower health and changed colour (if neccessary)
      lowerShieldHealth = (state:State, s:Shield):Shield =>
        createShield({id:s.id, createTime:state.time})
                    ({pos: s.pos,
                    radius:s.radius})
                    (s.health-1,determineShieldColour(s.health-1)),

      // lower health of each collided shield
      newShields = shieldsToReplace.map((shield:Shield)=>lowerShieldHealth(state, shield)),

      // check if the new shield with lowered health is valid (has a health above 0)
      isShieldActive = (s:Shield) => s.health > 0

    return newShields.filter(isShieldActive)
  },


  /**
   * Handles all collisions between objects, and the actions that occur when colliding
   * 
   * - Aliens with ship -> ends the game
   * - Enemy bullets with ship -> ends the game
   * - Player bullets with aliens -> kills alien, rewards points
   * - Any bullets with shields -> damages shield
   * - Aliens with bottom of screen -> ends game
   * 
   * Derived from the asteroids example code by Tim Dywer from https://tgdwyer.github.io/asteroids/
   * 
   * @param s the current state
   * @returns the new game state
   */
  handleCollisions = (s:State) => {

    const
      isPlayerBullet = (b:Body) => b.belongsTo == "ship",

      bodiesCollided = ([a,b]:[Body,Body]) => a.pos.sub(b.pos).len() < a.radius + b.radius,

      allPlayerBullets = s.bullets.filter(isPlayerBullet),
      allEnemyBullets = s.bullets.filter(not(isPlayerBullet)),

      // ship collides with aliens or enemy bullets only
      shipCollided = s.aliens.concat(allEnemyBullets).filter(r=>bodiesCollided([s.ship,r])).length > 0,
      
      // determines if player's bullet has touched an alien
      allPlayerBulletsAndAliens = flatMap(allPlayerBullets, bullet=> s.aliens.map<[Body,Body]>(alien=>([bullet,alien]))),
      collidedPlayerBulletsAndAliens = allPlayerBulletsAndAliens.filter(bodiesCollided),

      // determines if any bullet has touched a shield
      allBulletsAndShields = flatMap(s.bullets, bullet=> s.shields.map<[Body,Body]>(shield=>([bullet,shield]))),
      collidedBulletsAndShields = allBulletsAndShields.filter(bodiesCollided),

      // arrays holding collided objects
      collidedBullets = collidedPlayerBulletsAndAliens.concat(collidedBulletsAndShields).map(([bullet,_])=>bullet),
      collidedAliens = collidedPlayerBulletsAndAliens.map(([_,alien])=>alien),
      collidedShields = collidedBulletsAndShields.map(([_,shield])=>shield),
      
      // replace all shields that are hit with another shield with lower health.
      // only returns valid shields (shields with 0 HP are not returned)
      activeShields = changeHitShields(s, collidedShields),

      // check if aliens have reached bottom of screen -> end game
      alienReachedBottom = s.aliens.filter((a:Body) => a.pos.y > 550).length > 0 
    

    return <State>{
      ...s,
      shields: cut(s.shields.concat(activeShields))(collidedShields),
      bullets: cut(s.bullets)(collidedBullets),
      aliens: cut(s.aliens)(collidedAliens),
      exit: s.exit.concat(collidedBullets,collidedAliens,collidedShields),
      objCount: s.objCount + activeShields.length,
      gameOver: shipCollided || alienReachedBottom,
      gameWin: s.aliens.length==0,
      points: s.points + getHitAlienPoints(collidedAliens)
    }
  }


  /**
   * Manages all actions that occur after a certain time or in every tick of the game
   *
   * After a certain time:
   * - Bullets expire
   * - Aliens move and change directions
   * 
   * Constantly do/check for:
   * - Move bodies
   * - Aliens shoot
   * - Bodies collide
   * 
   * Derived from the asteroids example code by Tim Dywer from https://tgdwyer.github.io/asteroids/
   * 
   * @param s the current state
   * @param elapsed the current interval and random number pair
   * 
   */
  const tick = (s:State,elapsed:Interval_RND) => {
    const 
      expired = (b:Body)=>(elapsed.elapsed - b.createTime) > Constants.CanvasSize*Constants.BulletExpirationTime,
      expiredBullets = s.bullets.filter(expired),
      activeBullets = s.bullets.filter(not(expired)),

      alienMovingTime = (b:Alien)=>(elapsed.elapsed - b.createTime) >70/Constants.AlienVelocity,
      aliensToRespawn = s.aliens.filter(alienMovingTime)

    return handleCollisions(handleAlienPath(handleAlienShooting({
      ...s, 
      ship:moveShip(s.ship), 
      bullets:activeBullets.map(moveBody), 
      aliens: s.aliens.map(moveBody),
      exit:expiredBullets,
      time:elapsed.elapsed,
      
    },elapsed), aliensToRespawn ))
  },

    

    /**
     * The state transducer.
     * Listens for and changes attributes of the game's state when neccessary
     * 
     * Derived from the asteroids example code by Tim Dywer from https://tgdwyer.github.io/asteroids/
     * 
     * @param s the current state
     * @param e the instance of the class returned by the observable
     */
    reduceState = (s:State, e:LeftMove|RightMove|Shoot|Tick_rnd)=>
      e instanceof LeftMove ? {...s,
        ship: {...s.ship, leftMove:e.leftDown}
      } :
      e instanceof RightMove ? {...s,
        ship: {...s.ship, rightMove:e.rightDown}
      } :
      e instanceof Shoot ? {...s,
        bullets: s.bullets.concat([((unitVec:Vec)=>
                                  createBullet({id:String(s.objCount),createTime:s.time})
                                              ({radius:Constants.BulletRadius,
                                                 pos:s.ship.pos.add(unitVec)})
                                              (Vec.unitVecInDirection(0).scale(Constants.BulletVelocity))
                                              )(Vec.unitVecInDirection(0))
                                              ('ship')
                                              ('lightgreen')
                                ]),
        objCount: s.objCount + 1
      } : 
      tick(s,e.elapsed_rnd)
    

  /**
   * The main game stream. The subscription that runs the game.
   * Derived from the asteroids example code by Tim Dywer from https://tgdwyer.github.io/asteroids/
   */
  const subscription =
  // merge all observables into one stream
    merge(
      gameClock,
      startLeftMove,startRightMove,
      stopLeftMove,stopRightMove,
      shoot
      )
    .pipe(
      scan(reduceState, initialState)) // starting from the intial game state, listen for any changes
      .subscribe(updateView) // update the game view
  

  /**
   * Updates the SVG scene.
   * This is the only impure function in the spaceinvaders function.
   * Derived from the asteroids example code by Tim Dywer from https://tgdwyer.github.io/asteroids/
   * 
   * @param s the current state
   */
  function updateView(s: State) {
    const 
      svg = document.getElementById("canvas")!,
      ship = document.getElementById("ship")!,

    // updates the body, allowing it to move/change colour
    updateBodyView = (b:Body) => {
      function createBodyView() {
        const v = document.createElementNS(svg.namespaceURI, "ellipse")!;
        attr(v,{id:b.id,rx:b.radius,ry:b.radius, fill:b.colour});
        v.classList.add(b.viewType)
        svg.appendChild(v)
        return v;
      }
      const v = document.getElementById(b.id) || createBodyView(); 
      attr(v,{cx:b.pos.x,cy:b.pos.y, fill:b.colour});
    };

    attr(ship,{transform:`translate(${s.ship.pos.x},${s.ship.pos.y})`});
    s.shields.forEach(updateBodyView);
    s.bullets.forEach(updateBodyView);
    s.aliens.forEach(updateBodyView);

    // remove all objects from the canvas that are in the exit array
    s.exit.map(o=>document.getElementById(o.id))
          .filter(isNotNullOrUndefined)
          .forEach(v=>{
            try {
              svg.removeChild(v)
            } catch(e) {
              // rarely it can happen that a bullet can be in exit 
              // for both expiring and colliding in the same tick,
              // which will cause this exception
              console.log("Already removed: "+v.id)
            }
          })
    
    // update the number of points
    const v = document.getElementById("points");
    v.textContent = "Points: "+ String(s.points)
    svg.appendChild(v);
        
    
    if(s.gameOver || s.gameWin) {
      const v = document.getElementById("gameover");
      //const v = document.createElementNS(svg.namespaceURI, "text")!;
      //attr(v,{x:Constants.CanvasSize/6,y:Constants.CanvasSize/2,class:"gameover", id:"gameover"});
      //v.textContent = s.gameOver ? "Game over" : "You win!";
      //svg.appendChild(v);
      subscription.unsubscribe(); // quit current game
      
      // remove all items on the canvas to prepare for new game
      const itemsToRemove = s.bullets.concat(s.aliens)
      itemsToRemove.map(o=>document.getElementById(o.id))
          .filter(isNotNullOrUndefined)
          .forEach(v=>{
            try {
              svg.removeChild(v)
            } catch(e) {
              // rarely it can happen that a bullet can be in exit 
              // for both expiring and colliding in the same tick,
              // which will cause this exception
              console.log("Already removed: "+v.id)
            }
          })
      spaceinvaders() // start new game
    }
  }
}



/**
 * Displays the currently pressed down key.
 * This is an impure function.
 * From the asteroids example code by Tim Dywer from https://tgdwyer.github.io/asteroids/
 */
function showKeys() {
  function showKey(k:Key) {
    const arrowKey = document.getElementById(k)!,
      o = (e:Event) => fromEvent<KeyboardEvent>(document,e).pipe(
        filter(({code})=>code === k))
    o('keydown').subscribe(e => arrowKey.classList.add("highlight"))
    o('keyup').subscribe(_=>arrowKey.classList.remove("highlight"))
  }
  showKey('ArrowLeft');
  showKey('ArrowRight');
  showKey('ArrowUp');
  showKey('Space');
}
setTimeout(showKeys, 0)

// the following simply runs your pong function on window load.  Make sure to leave it in place.
if (typeof window != 'undefined')
window.onload = ()=>{
  spaceinvaders();
  showKeys();
}
  
  

/////////////////////////////////////////////////////////////////////
// Utility functions
// All from the asteroids example code by Tim Dywer from https://tgdwyer.github.io/asteroids/

/**
 * A simple immutable vector class
 * 
 * From the asteroids example code by Tim Dywer from https://tgdwyer.github.io/asteroids/
 */
 class Vec {
  constructor(public readonly x: number = 0, public readonly y: number = 0) {}
  add = (b:Vec) => new Vec(this.x + b.x, this.y + b.y)
  sub = (b:Vec) => this.add(b.scale(-1))
  len = ()=> Math.sqrt(this.x*this.x + this.y*this.y)
  scale = (s:number) => new Vec(this.x*s,this.y*s)
  ortho = ()=> new Vec(this.y,-this.x)
  rotate = (deg:number) =>
            (rad =>(
                (cos,sin,{x,y})=>new Vec(x*cos - y*sin, x*sin + y*cos)
              )(Math.cos(rad), Math.sin(rad), this)
            )(Math.PI * deg / 180)

  static unitVecInDirection = (deg: number) => new Vec(0,-1).rotate(deg)
  static Zero = new Vec();
}

/**
 * apply f to every element of a and return the result in a flat array
 * From the asteroids example code by Tim Dywer from https://tgdwyer.github.io/asteroids/
 * 
 * @param a an array
 * @param f a function that produces an array
 */
function flatMap<T,U>(
  a:ReadonlyArray<T>,
  f:(a:T)=>ReadonlyArray<U>
): ReadonlyArray<U> {
  return Array.prototype.concat(...a.map(f));
}

const 
/**
 * Composable not: invert boolean result of given function
 * From the asteroids example code by Tim Dywer from https://tgdwyer.github.io/asteroids/
 * 
 * @param f a function returning boolean
 * @param x the value that will be tested with f
 */
  not = <T>(f:(x:T)=>boolean)=> (x:T)=> !f(x),

/**
 * is e an element of a using the eq function to test equality?
 * From the asteroids example code by Tim Dywer from https://tgdwyer.github.io/asteroids/
 * 
 * @param eq equality test function for two Ts
 * @param a an array that will be searched
 * @param e an element to search a for
 */
  elem = 
    <T>(eq: (_:T)=>(_:T)=>boolean)=> 
      (a:ReadonlyArray<T>)=> 
        (e:T)=> a.findIndex(eq(e)) >= 0,
/**
 * array a except anything in b
 * From the asteroids example code by Tim Dywer from https://tgdwyer.github.io/asteroids/
 * 
 * @param eq equality test function for two Ts
 * @param a array to be filtered
 * @param b array of elements to be filtered out of a
 */ 
  except = 
    <T>(eq: (_:T)=>(_:T)=>boolean)=>
      (a:ReadonlyArray<T>)=> 
        (b:ReadonlyArray<T>)=> a.filter(not(elem(eq)(b))),

/**
 * set a number of attributes on an Element at once
 * From the asteroids example code by Tim Dywer from https://tgdwyer.github.io/asteroids/
 * 
 * @param e the Element
 * @param o a property bag
 */         
  attr = (e:Element,o:Object) =>
    { for(const k in o) e.setAttribute(k,String(o[k])) }

/**
 * Type guard for use in filters
 * From the asteroids example code by Tim Dywer from https://tgdwyer.github.io/asteroids/
 * 
 * @param input something that might be null or undefined
 */
function isNotNullOrUndefined<T extends Object>(input: null | undefined | T): input is T {
  return input != null;
}
