
// Will be set at game init
var W=null;
var H=null;
var N_SHEEP=10;
var ROUND_TIME = 30;
var RECHARGE_WAIT=2.0;

var assetsObj = {
    "sprites": {
        "sheep.png": {
            tile: 73,
            tileh: 50,
            map: {
                sheep: [0,0],
                sheep_zap: [1,0]
            } 
        },
        "bush.png": {
            tile: 150,
            tileh: 70,
            map: {
                bush: [0,0]
            }
        },
        "wolf.png": {
            tile: 100,
            tileh: 100,
            map: {
                wolf: [0,0]
            }
        }
    }
}

Crafty.c("Sheep",{
    required: "2D, SheepCanvas, sheep, Gravity, Collide, Delay, SpriteAnimation",
    events: {
        "LandedOnGround": function(){
            if(this.dead){ this.vx = 0; return; }
            this.vy = (-Math.random()*100 - 100) * (Math.abs(this.fear) + 0.5);
            this.vx = Math.random() * 100;
            if(this.fear > 0 ){
                this.vx *= this.fear + 0.5;
            }else if(this.fear < 0){
                this.vx *= this.fear - 0.5;
            }else{
                this.vx = 50 - this.vx;
            }
        },
        "UpdateFrame": function(e){
            if(this.x > W - 50 && this.vx > 0){ this.vx *= -1 }
            else if(this.x < 50 && this.vx < 0){ this.vx *= -1 }
    
            if(this.vx < 0){ this.flip("X")
            }else{ this.unflip("X") }       
            if(this.dead){ this.flip("Y"); } 
    
            // Subside Fear
            if(this.fear > 0){
                this.fear -= 0.25 * (e.dt/1000); // fear subsides
            }else if(this.fear < 0){
                this.fear += 0.25 * (e.dt/1000); // fear subsides
            }
            if( Math.abs(this.fear) < 0.05){ this.fear = 0; }
        }
    },
    fear: function(x){
        var d = this.x - x 
        if(Math.abs(d) < 300){
            this.fear = d / 300;
        } 
    },
    zap_die: function(){
        this.y -= 50;
        this.vx = 0;
        this.vy = 0;
        this.antigravity();
        // TODO flash skeleton anim
        this.animate("zapped",-1);
        this.delay(function(){ 
            this.visible = false; 
            this.gravity("platform");
            this.die();
        },1000);
    },
    eat: function(){
        sheep_lost();
        Crafty.s("SheepCanvas").detach(this);
        this.visible = false;
        this.dead = true;
    },
    die: function(){
        if(this.dead){ return; }
        this.flip("Y");
        this.dead = true;
        this.vx = 0;
        sheep_lost();
    },
    init: function(){
        this.reel("zapped",250,[ [0,0],[1,0]] );
        this.gravity("platform");
        this.w = 73;
        this.h = 50;  
        this.fear = 0; // bias on vx in hop 
        this.dead = false;
    }
});

Crafty.c("Wolf",{
    required: "2D, wolf, WolfCanvas, Tween, Delay",
    events: {
        "TweenEnd": function(e){
            if(this.state == "grabbing"){
                this.eat_sheep();
                this.delay(this.pop_down,500);
            }else if(this.state == "popping-down"){
                this.wait_sneak(3);
            }else{
            }
        }
    },
    init: function(){
        this.state = "hiding";
    },
    wait_sneak: function(seconds){
        this.delay(this.hide_in_new_bush,seconds * 1000);
        this.state = "sneaking"
        return this;
    },
    hide_in_new_bush: function(){
        var b = Crafty("bush").get( Math.floor(Math.random() * Crafty("bush").length))
        this.x = b.x;
        this.y = H; 
        this.state = "preparing";
        this.delay(this.pop_up,3000);
        b.wiggle();
    },
    pop_up: function(){
        this.state = "grabbing";
        this.tween({y:H-140},500);
    },
    pop_down: function(){
        this.state = "popping-down";
        this.tween({y:H},500);
    },
    eat_sheep: function(){
        // Eat Sheep
        var d = W;
        var wolfx = this.x;
        var eaten = 0;
        Crafty("Sheep").each(function(){
            if( this.dead ){ return; }
            if( Math.abs(wolfx - this.x + 25 ) < d ){
                d = Math.abs(wolfx - this.x);
                if(d < 50 && eaten < 3){ 
                    this.eat(); 
                    eaten++;
                }
            } 
        })
    }
});

Crafty.c("Bush", {
    required: "bush, 2D, BushCanvas, Tween",
    init: function(){
        this.wiggle_time = 0;
    },
    wiggle: function(){
        this.wiggle_time = 3.0;
    },
    events: {
        "UpdateFrame": function(e){
            if(this.wiggle_time > 0){
                this.rotation = Math.sin(this.wiggle_time * 20) * 5;
                this.wiggle_time -= e.dt/1000;
            }else{
                this.rotation = 0;
            }
        }
    }
});


function subdivide(p1,p2,d){
    var mid = p2.clone().subtract(p1).scale(0.5).add(p1);
    mid.x += (0.5 - Math.random()) * (30*d);
    mid.y += (0.5 - Math.random()) * (30*d);
    if( d > 0 ){
        return subdivide(p1,mid,d-1).concat(subdivide(mid,p2,d-1));  
    }
    return [p1,mid,p2];
}

Crafty.c("Lightning", {
    required: "2D, LightningCanvas",
    init: function(){
        this.recharge = 0;
        this.zap = null;
        this.ready = true;
    },
    do_zap: function(x,y){
        if(this.recharge > 0){ return false; }
        console.log("Zapping",[x,y]);
        this.zap = {
            decay:1.0,
            color:"blue",
            line: this.zap_line(x,y)
        };
        console.log(this.zap.line);
        this.recharge = RECHARGE_WAIT;

        // and zap fear and maybe zap a sheep
        var zapped = null;
        Crafty("Sheep").each(function(){
            if( this.dead ){ return; }
            
            var sheep_pt = new Crafty.math.Vector2D(this.x+36,this.y+25);
            var zap_pt = new Crafty.math.Vector2D(x,y);
            var d = zap_pt.subtract(sheep_pt).magnitude();
            var dx = this.x - x;  

            //console.log(d);
            if( Math.abs(d) < 300){
                this.fear = (300 - Math.abs(dx)) / 300 * Math.sign(dx);
                if( Math.abs(d) < 50 && zapped == null){ // only zap one max
                    zapped = this;
                    this.zap_die();
                }
            }
        });

        return true;
    },
    zap_line: function(x,y){
        var p1 = new Crafty.math.Vector2D(x + (0.5-Math.random()) * W/2,0);
        var p2 = new Crafty.math.Vector2D(x,y);

        return subdivide(p1,p2,Math.ceil(Math.random() * 4) + 1);
    },
    events: {
        "UpdateFrame": function(e){
            if(this.recharge > 0){
                this.recharge -= e.dt/1000;
            }
            if(this.zap != null){
                this.trigger("Invalidate");
                this.zap.decay -= (e.dt/1000);
                if(this.zap.decay < 0){
                    this.zap = null;
                }
            }          
        },
        "Draw": function(e){
            if(this.zap != null){
                var weight = Math.floor(this.zap.decay * 5);
                if(weight == 0){
                    this.zap = null;
                    return;
                } 
                var ctx = e.ctx;
                ctx.lineWidth = weight;
                ctx.strokeStyle = this.zap.color;
                ctx.beginPath();
                ctx.moveTo(this.zap.line[0].x,this.zap.line[0].y);
                for(var i=1;i<this.zap.line.length; i++){
                    var p = this.zap.line[i];
                    ctx.lineTo(p.x,p.y); 
                }
                ctx.stroke();
            } 
        }   
    }
});

var countdown;
var score;

function game_over_fail(){
    message("Game Over\nSorry, you didn't make it!");
    //Crafty.pause();
}

function countdown_handler(){
    countdown -= 1;
    document.getElementById("countdown").innerHTML = countdown;
    if(countdown == 0){
        message("Game Over!\nYour Score: " + score);
        //Crafty.pause();
    }else{
        setTimeout(countdown_handler,1000);      
    }
}

function sheep_lost(){
    score -= 1;
    document.getElementById("sheep_cnt").innerHTML = score;
    if( score == 0 && countdown > 0){
        game_over_fail();
    }
}

function message(txt){
    alert(txt);
}

function run(){
    
    W = Crafty.stage.elem.clientWidth;
    H = Crafty.stage.elem.clientHeight;
  
    // Three layers 
    Crafty.createLayer("SheepCanvas","Canvas",{z:1000});
    Crafty.createLayer("LightningCanvas","Canvas",{z:500});
    Crafty.createLayer("BushCanvas","Canvas",{z:200});
    Crafty.createLayer("WolfCanvas","Canvas",{z:100});
     
    // Build Floor 
    var floor = Crafty.e("2D, SheepCanvas, Color, platform, Mouse")
        .color("green")
        .attr({x:0, y:H-5,w:W,h:5});

    // And bushes evenly distributed, with some randomness
    for(var i=0; i<(W/100); i++){
        Crafty.e("Bush")
            .attr({x:i*100+(5-Math.random()*10),y:H-70,w:125,h:70});
    }

    // Create the wolf, hidden
    var wolf = Crafty.e("Wolf")
        .attr({x: W/2, y: H})

    // And create the sheep
    for(var i=0; i<N_SHEEP; i++){
        var s = Crafty.e("Sheep")
            .attr({
                vx: 50-Math.random()*100,
                vy: -50*Math.random()-50,
                x: W/2 + (50-Math.random()*100),
                y: 100 + 100*Math.random()
            });
    }
  
    var lightning = Crafty.e("Lightning") 
                    .attr({x:0,y:0,w:W,h:H});

    var first_click = true;
    // Bind lightning mouse handler
    Crafty.s("Mouse").bind("Click", function(e){
        console.log(e);
        if(first_click){
            document.getElementById("intro").className = "hide";
        }
        lightning.do_zap(e.clientX,e.clientY);
    });

    // Start Round (todo make it in a separate object)
    countdown = ROUND_TIME; 
    score = N_SHEEP;
    document.getElementById("sheep_cnt").innerHTML = score;
    setTimeout(countdown_handler,1000);
    wolf.wait_sneak(7);
    
}

window.onload = function() {
    Crafty.init();
    Crafty.load(assetsObj, run)
    
};


