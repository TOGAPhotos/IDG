export function Counter(){
    let LIMIT = 0;
    return{
        add:function(){
            LIMIT++;
        },
        reduce:function(){
            LIMIT--;
        },
        reset:function(){
            LIMIT = 0;
        }
    }
}