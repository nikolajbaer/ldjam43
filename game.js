
// Will be set at game init
var W=null;
var H=null;
var N_SHEEP=10;
var RECHARGE_WAIT=2.0;

var assetsObj = {
    "sprites": {
        "sheep.png": {
            tile: 73,
            tileh: 50,
            map: {
                sheep: [0,0]
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
    required: "2D, SheepCanvas, sheep, Gravity, Collide",
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
    init: function(){
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
        this.delay(this.pop_up,1000);
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
        var closest = null;
        var d = W;
        var wolfx = this.x;
        Crafty("Sheep").each(function(){
            if( Math.abs(wolfx - this.x ) < d ){
                closest = this;
                d = Math.abs(wolfx - this.x);
            } 
        })
        if(d < 50){
            closest.flip("Y");
            closest.dead = true;
            closest.canLand = false;
            closest.vx = 0;
            closest.vy = -200;
            Crafty.s("SheepCanvas").detach(closest); 
            Crafty.s("WolfCanvas").attach(closest);   
        }
    }
});

Crafty.c("Bush", {
    required: "bush, 2D, BushCanvas, Tween",
    init: function(){
        this.wiggle_time = 0;
    },
    wiggle: function(){
        this.wiggle_time = 1.0;
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

Crafty.c("Lightning", {
    required: "2D, LightningCanvas",
    init: function(){
        this.recharge = 0;
        this.zap = null;
        this.ready = true;
    },
    do_zap: function(x,y){
        if(this.recharge > 0){ return; }
        console.log("Zapping",[x,y]);
        this.zap = {
            decay:1.0,
            color:"blue",
            line: this.zap_line(x,y)
        };
        this.recharge = RECHARGE_WAIT;
    },
    zap_line: function(x,y){
        var l_start = {x:x,y:0};
        var l_end = {x:x,y:y};
        return [l_start,l_end];
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
        .wait_sneak(7);

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

    // Bind lightning mouse handler
    Crafty.s("Mouse").bind("Click", function(e){
        console.log(e);

        lightning.do_zap(e.clientX,e.clientY);

        Crafty("Sheep").each(function(){
            var d = this.x - e.clientX;
            //console.log(d);
            if( Math.abs(d) < 300){
                this.fear = (300 - Math.abs(d)) / 300 * Math.sign(d);
            }
        });
    });
}

window.onload = function() {
    Crafty.init();
    Crafty.load(assetsObj, run)
    
};


