export function Counter(){
    let number = 0;
    return{
        add:function(){
            number++;
        },
        reduce:function(){
            number--;
        },
        reset:function(){
            number = 0;
        },
        get:function (){
            return number;
        }
    }
}