let gnbList = ['brush', 'eraser', 'emoticon', 'shape'];  
let subParent = document.querySelector('.header__sub');

function gnbInner(){
    let gnbParent = document.querySelector('.gnb__inner');
        
    for(let i =0;i < gnbList.length;i++){
        // console.log(gnbList[i]);
        gnbParent.innerHTML += `<li class="gnb__list ${gnbList[i]}"><button class="btn ${gnbList[i]}"><span class="blind">${gnbList[i]}</span></button></li>`;
        // subParent.innerHTML += `<div class="subMenuWrap ${gnbList[i]}"></div>`;
    }
}
gnbInner();

let gnbTab = document.querySelectorAll('.subMenuWrap'); 
let gnbBtn = document.querySelectorAll('.gnb__list .btn');
function gnbMenu(){
    for(let i = 0; i < gnbBtn.length; i++){
        gnbBtn[0].parentNode.classList.add('active');
        gnbBtn[i].addEventListener('click', ()=> {
           // console.log(gnbBtn[i]);
            gnbBtn.forEach((i) => i.parentNode.classList.remove('active'));
            gnbBtn[i].parentNode.classList.add('active');
            gnbTab.forEach((i) => i.classList.remove('active'));
            gnbTab[i].classList.add('active');

            let dellBtn = document.querySelector('.delete__all');

            if (i === 1) {
                dellBtn.classList.add('active');
            } else {
                dellBtn.classList.remove('active');
            }
        })
    }
}

let subWrap = document.querySelectorAll('.subMenuWrap');
function subGnb(){
    
    let subList = document.querySelectorAll('.subMenu__inner');
    let subname = [
        ["pen", "calligraphy", "crayon", "highlighter", "spray", "bucket"],
        ["eraser1", "eraser2", "eraser3"],
        ["line", "rect", "circle", "ellipse", "triangle", "pentagon", "hexagon", "bubble"],
        ["sticker_01", "sticker_02", "sticker_03", "sticker_04", "sticker_05", "sticker_06", "sticker_07", "sticker_08", "sticker_09", "sticker_10", "sticker_11", "sticker_12", "sticker_13", "sticker_14", "sticker_15", "sticker_16", "sticker_17", "sticker_18", "sticker_19"]
    ];  

    for (let i = 0; i < gnbTab.length; i++) {
        let subMenuInner = subList[i];
        let subMenuItems = subname[i];
        // console.log(subMenuInner);
        // console.log(subMenuItems);

        for (let j = 0; j < subMenuItems.length; j++) {            
            let menuItem = document.createElement('li');
            menuItem.className = `subMenu__list ${j === 0 && i === 0 ? 'active' : ''}`;
            menuItem.innerHTML = `<button class="btn ${subMenuItems[j]}"><span class="blind">${subMenuItems[j]}</span></button>`;
            subMenuInner.appendChild(menuItem);
        }        
    }

    var buttons = document.querySelectorAll('.subMenu__list button');
    buttons.forEach(function(btn) {
        btn.addEventListener('click', ()=> {
            toggleActive(btn);
        });
    });

    // active 클래스를 토글
    function toggleActive(clickedButton) {
        // 모든 버튼에 대해 active 클래스를 제거
        buttons.forEach((btn) => btn.closest('.subMenu__list').classList.remove('active'));
        // buttons.forEach(function(btn) {
        //     btn.closest('.subMenu__list').classList.remove('active');
        // });
        // 클릭한 버튼에 대해 active 클래스를 토글
        clickedButton.closest('.subMenu__list').classList.add('active');
    }
}

function penDp(){
    let pendp = document.querySelectorAll('.btn__pendp');
    
    for(let i = 0; i < pendp.length; i++){
        pendp[0].classList.add('active');
        pendp[i].addEventListener('click', ()=>{
            // console.log(pendp[i]);
            pendp.forEach((i) => i.classList.remove('active'));
            pendp[i].classList.add('active');
        })
    }
}

function btnsColor(){
    let btns = document.querySelectorAll('.btn__color');

    for(let i = 0; i < btns.length; i++){
        btns[0].classList.add('active');
        btns[i].addEventListener('click', ()=>{
            // console.log(btns[i]);
            btns.forEach((i) => i.classList.remove('active'));
            btns[i].classList.add('active');
        })
    }
}

function pickerOpen(){
    let btnPicker = document.querySelector('.btn__colorPicker');
    let parent = document.querySelector('.colorPicker');

    btnPicker.addEventListener('click', ()=>{
        parent.classList.toggle('active')
    })
}

function zoomDrag(){
    let dragOn = document.querySelector('.btn__zoom.move');
    dragOn.addEventListener('click', ()=>{
        dragOn.classList.toggle('active')
    })
}

let count = 0;
let click = 0;
let scrollY = document.querySelector('.colorPicker__scroll');
let btnList = ['a','b','c','d','e','f','g','h','i','j','k','l','m'];

function btnScroll(){    
    for(let i =0;i < btnList.length;i++){
        scrollY.innerHTML += `<button class="btn btn__color btn__color--${btnList[i]}"></button>`;
        // console.log(btnList[i]);            
    }
}
btnScroll();


function eraserSize(){  
    const btnParent = document.querySelector('.colorPicker__eraser');    
    const btnSize = ['small','mid','large','xlarge'];
    
    for(let i = 0; i < btnSize.length; i++){
        btnParent.innerHTML += `<button class="btn btn__pendp btn__pendp--${btnSize[i]}"><span class="blind">지우개 ${btnSize[i]}</span></button>`;      
    }
}
eraserSize();

let btnHeight = document.querySelector('.btn__color').offsetHeight;
let btnUp = document.querySelector('.btn__up');
let btnDown = document.querySelector('.btn__down');

// btn__up
function moveUp(){
    btnUp.disabled = true;
    btnUp.addEventListener('click', ()=>{
        count-= btnHeight + 12;
        click--;

        scrollY.style.transform = 'translateY(-' + count + 'px)';
        btnDown.disabled = false;

        if(click == 0){
            count = 0;
            btnUp.disabled = true;
        }
    })
}
// btn__down
function moveDown(){
    btnDown.addEventListener('click', ()=>{
        count+= btnHeight + 12;
        click++;

        scrollY.style.transform = 'translateY(-' + count + 'px)';
        btnUp.disabled = false;
        
        if(btnList.length-4 == click){                                                 
            btnDown.disabled = true;
        }
    })
}

function zoomTools(){
    let zoomP = document.querySelector('.btn__zoom.enlargement');
    let zoomM = document.querySelector('.btn__zoom.reduction');
    let zoomRange = document.querySelector('.zoomRange');
    let zValue = zoomRange.value;
    let sNum = Number(zValue);

    zoomRange.addEventListener('input', (e)=>{
    // console.log(sNum);
        sNum = Number(this.value);         
    });    
    
    zoomP.addEventListener('click', (e)=>{  
        if(sNum <= 99){
            zoomRange.stepUp(2);
            sNum+=10;
            // console.log(typeof sNum, sNum);
        } else {
            sNum == 100;
        }
    });

    zoomM.addEventListener('click', (e)=>{
        if(sNum == 0){
            sNum == 0;
        } else {
            zoomRange.stepDown(2);
            sNum-=10;
        }
    });
}


gnbMenu();
subGnb();
penDp();
btnsColor();
zoomTools();
pickerOpen();
zoomDrag();
moveUp();
moveDown();

