{
    var parameters = new Array(400);
    const init = () => {
        createGrid(20);
        createColourButtons();
        document.querySelector(".toggleExperimental").addEventListener(`click`, handleClickToggleExperimental);
        document.querySelector(".amountOfSquares").addEventListener(`change`, handleChangeAmountOfSquares);
    }

    const handleClickToggleExperimental = () => {
        $body = document.querySelector("body");
        if($body.classList.contains("experimental")){
            $body.classList.remove("experimental");
        } else {
            $body.classList.add("experimental");
        }
    }

    const createGrid = amount =>{
        $grid = document.querySelector(".grid");
        $grid.innerHTML = "";
        for(row = 0; row < amount; row++){
            $row = document.createElement('div');
            $row.classList.add("row");
            if(row % 2 != 0){
                $row.style.marginLeft = (50 / amount)+"%";
                $row.style.marginRight = (-50 / amount)+"%";
            }
            $row.style.height = (100 / amount)+"%";
            $row.classList.add("row_"+row);
            for(col = 0; col<amount; col++){
                $row.append(createSquare(col, row, amount));
            }
            $grid.append($row);
        }
    } 

    const createSquare = (col, row, amount) =>{
        $square = document.createElement('div');
        $square.classList.add("square");
        $square.classList.add("square-"+row+"-"+col);
        $square.style.width = (100/amount) +"%";
        $square.addEventListener(`click`, handleSquareClick);
        $square.addEventListener(`mouseover`, handleSquareHover);
        return ($square);
    }

    const handleSquareClick = e => {
        document.querySelectorAll(".colourButton").forEach(colour => {
            if(colour.checked){
                $name = e.currentTarget.classList[1];
                console.log(e.currentTarget);
                if(e.currentTarget.classList.length >= 2 && e.currentTarget.classList[2] != null){
                    e.currentTarget.classList.remove("planet_"+parameters[$name.split("-")[1]*20+$name.split("-")[2]][0]);
                }
                $parameters = document.getElementById("parametersToGive").value;
                parameters[$name.split("-")[1]*20+$name.split("-")[2]] = [colour.value, $parameters];
                e.currentTarget.classList.add("planet_"+colour.value);    
            }
        })
        data = "text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(parameters));
        a = document.querySelector(".downloadJSON");
        a.href = 'data:' + data;
        a.download = 'data.json';
        a.innerHTML = 'download JSON';
    }

    const handleSquareHover = e => {
        if(e.currentTarget.classList.length >= 3){
            $name = e.currentTarget.classList[1];
            document.getElementById("parametersFrom").value = parameters[$name.split("-")[1]*20+$name.split("-")[2]][1]; 
        } else {
            document.getElementById("parametersFrom").value = "Empty";
        }
    }

    const createColourButtons = () => {
        colours = ["blue", "cyan", "green", "yellow", "orange", "red", "pink", "purple"];
        colours.forEach(colour => {
            $colourButtonWrapper = document.querySelector(".colourButtonWrapper");
            $button = document.createElement("input");
            $button.name = "colourButton";
            $button.classList.add("colourButton");
            $button.type = "radio";
            $button.value = colour;
            $checkmark = document.createElement("span");
            $checkmark.classList.add("colourButtonCheckmark");
            $checkmark.classList.add("colourButton_"+colour);
            $container = document.createElement("label");
            $container.classList.add("colourButtonContainer");
            $container.append($button);
            $container.append($checkmark);
            $colourButtonWrapper.append($container);
        })
    }

    const handleChangeAmountOfSquares = e => {
        createGrid(e.currentTarget.value);
    }

    init();
}
