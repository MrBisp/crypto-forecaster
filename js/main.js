$(document).ready(async function(){
    let url = 'https://api.coingecko.com/api/v3';

    let coinSelect = $('#coinSelect');
    let coin = $('#coinSelect').val();
    let amount = $('#amount').val();
    let fiat = $('#fiatSelect').val();
    let staking = $('#stakingRewards').val();

    //used for local storage and so on. Do not change names
    let cryptoPrices = {}
    let fiatPrices = {}
    let cryptoInFiat = {};
    let fiats = {};
    let topCryptos = {};
    let priceHistory = {};

    //If the local storage is fresh, load the data
    if(!localStorageIsOutdated()){
        loadFromLocalStorage();
    }
    await updateCryptosInDOM();
    await updateFiatsInDOM();
    await calculatePriceHistory(coin, fiat);


    //Initialize
    updateForecastTable();
    showInFiat();


    $('#percentageInput, #yearsInFuture').change(function(e){
        updateForecastTable();
    });
    $('#coinSelect').change(function(){
        coin = $('#coinSelect').val();
        updateForecastTable();
        calculatePriceHistory(coin, fiat);
        if(coin == 'cardano'){
            $('#stakingRewards').show();
            $('#stakingRewardsLabel').show();
        } else {
            $('#stakingRewards').hide();
            $('#stakingRewardsLabel').hide();
        }
        showInFiat();
    });
    $('#amount').change(function(){
        amount = $('#amount').val();
        $('#output').text(calculateValue(cryptoInFiat[coinSelect.val()][fiat], amount) + ' ' + fiat);
        updateForecastTable();
        showInFiat();
    });
    $('#fiatSelect').change(function(){
        fiat = $('#fiatSelect').val();
        updateForecastTable();
        showInFiat();
    })
    $('#stakingRewards').change(function(){
        staking = $('#stakingRewards').val();
        updateForecastTable();
    })

    async function updateForecastTable(){
        $('#forecastTable tr:not(:first)').remove();

        //Update prices
        await getCryptoPriceInFiat(coinSelect.val(), fiat);


        let year = 0;
        let price = cryptoInFiat[coin][fiat];
        let amountHolding = amount;
        let valueOfHoldings = price * amount;
        let marketCap = cryptoPrices[coin].marketCap;

        let y = $('#yearsInFuture').val();

        for(let i = 1; i<=y; i++){
            year++;
            price = price * ( 1 + $('#percentageInput').val() / 100);
            amountHolding = amountHolding * (1 + staking / 100);
            valueOfHoldings = price * amountHolding;
            marketCap = cryptoPrices[coin].circulating_supply * price;
            let $tr = $('<tr>').append(
                $('<td>').text(year),
                $('<td>').text(formatBigNumber(price) + ' ' + fiat),
                $('<td>').text(formatOutput(amountHolding)),
                $('<td>').text(formatBigNumber(valueOfHoldings) + ' ' + fiat),
                $('<td>').text(formatBigNumber(marketCap) + ' ' + fiat)
            ).appendTo('#forecastTable');
        }
    }

    //Output in a easy read format, the price * amount
    function calculateValue(price, amount){
        let number = (price * amount);
        let nf = Intl.NumberFormat();
        return nf.format(number);
    }

    //Takes a number and outputs it beautifully
    function formatOutput(s){
        let nf = Intl.NumberFormat();
        return nf.format(s);
    }

    //Make a larger number more readable
    function formatBigNumber(n){
        if(n > 1000000000000000000000000){
            n = n / 1000000000000000000000000
            return formatOutput(parseFloat(n.toString()).toFixed(2)) + ' septillion';
        } else if(n > 1000000000000000000000){
            n = n / 1000000000000000000000
            return formatOutput(parseFloat(n.toString()).toFixed(2)) + ' sextillion';
        } else if(n > 1000000000000000000){
            n = n / 1000000000000000000
            return formatOutput(parseFloat(n.toString()).toFixed(2)) + ' quintillion';
        } else if(n > 1000000000000000){
            n = n / 1000000000000000
            return formatOutput(parseFloat(n.toString()).toFixed(2)) + ' quadrillion';
        } else if(n > 1000000000000){
            n = n / 1000000000000
            return formatOutput(parseFloat(n.toString()).toFixed(2)) + ' trillion';
        } else if (n > 1000000000){
            n = n / 1000000000
            return formatOutput(parseFloat(n.toString()).toFixed(2)) + ' billion';
        } else if (n > 1000000){
            n = n / 1000000
            return formatOutput(parseFloat(n.toString()).toFixed(2)) + ' million';
        }

        return formatOutput(parseFloat(n.toString()).toFixed(2));
    }

    async function showInFiat(){
        await getCryptoPriceInFiat(coinSelect.val(), fiat);
        await $('#output').text('Equals ' + calculateValue(cryptoInFiat[coinSelect.val()][fiat], amount) + ' in ' + fiat);
    }

    //Gets a crypto in a fiat currency. If the price is saved, return in. If not, make a call for it
    async function getCryptoPriceInFiat(coin, fiat){
        let doUpdate = false;
        if(!cryptoInFiat.hasOwnProperty(coin)){
            //Update if the coin does not have ANY fiat prices associated with it
            doUpdate = true;
        } else {
            if(cryptoInFiat[coin].hasOwnProperty(fiat)){
                //Update if the fiat price is not yet saved in regards to the coin
                return cryptoInFiat[coin][fiat];
            } else {
                doUpdate = true;
            }
        }

        //If we need to make a call, save only the appropiate data
        if(doUpdate){
            console.log("Updating " + coin + " in " + fiat +" price");

            await getCryptoPriceInUSD(coin);
            await getFiatCurrency('USD', fiat);

            //If it does not yet exists, we have to add it to the object
            if(!cryptoInFiat.hasOwnProperty(coin)){
                cryptoInFiat[coin] = {}
            }
            cryptoInFiat[coin][fiat] = cryptoPrices[coin].price * fiatPrices[fiat];
            updateLocalstorage();
            return cryptoPrices[coin].price * fiatPrices[fiat];
        }
    }

    //Return a crypto price in USD. Gets the price if it does not yet exist.
    async function getCryptoPriceInUSD(coin){
        if(!cryptoPrices.hasOwnProperty(coin)){
            addMessage('Getting price of ' + coin + ' in USD');
            console.log("getting " + coin + " in USD");
            await $.ajax({
                url: url + '/coins/' + coin,
                headers: {'Access-Control-Allow-Origin': '*' },
                success: function(result) {
                    console.log(coin + ' in USD: ' + result.market_data.current_price.usd)
                    if(!cryptoPrices.hasOwnProperty(coin)){
                        cryptoPrices[coin] = {};
                    }
                    cryptoPrices[coin].price = result.market_data.current_price.usd;
                    cryptoPrices[coin].marketCap = result.market_data.market_cap.usd;
                    cryptoPrices[coin].circulating_supply = result.market_data.circulating_supply;
                    addMessage('Finished getting price of ' + coin + ' in USD');
                    return cryptoPrices[coin].price;
                }

            });
        } else {
            return cryptoPrices[coin].price;
        }

    }

    //Returns a fiat price compared to the USD (or other base)
    async function getFiatCurrency(base, output){
        if(!fiatPrices.hasOwnProperty(output)){
            console.log("updating " + output + " in " + base);
            addMessage("Getting price of " + output + " in " + base);
            await $.ajax({
                url: 'https://api.exchangeratesapi.io/latest?base='+base,
                success: function(result){
                    fiatPrices[output] = result.rates[output];
                    addMessage("Updated price of " + output + " in " + base);
                    return result.rates[output];
                }
            });
        } else {
            return fiatPrices[output];
        }

    }

    //Updates the local storage
    function updateLocalstorage(){
        localStorage.setItem("lastUpdated", Date.now().toString());

        let saveObj = {cryptoPrices, fiatPrices, cryptoInFiat, fiats, topCryptos, priceHistory};
        localStorage.setItem("savedData", JSON.stringify(saveObj));
    }

    //Load data from local storage
    function loadFromLocalStorage(){
        let data = JSON.parse(localStorage.getItem("savedData"));
        cryptoInFiat = data.cryptoInFiat;
        fiatPrices = data.fiatPrices;
        cryptoPrices = data.cryptoPrices;
        fiats = data.fiats;
        topCryptos = data.topCryptos;
        priceHistory = data.priceHistory;
    }

    //Check to see if the local storage is outdated. Returns true if outdated
    function localStorageIsOutdated(){
        let data = localStorage.getItem("lastUpdated");

        if(data == null) {
            return true;
        }

        let now = Date.now();
        let timelimit = 1000 * 60 * 60; //1 hour

        if(now - data < timelimit){
            //Less than timelimit has passed (1 hour)
            console.log('less than 1 hour');
            addMessage('Getting cached data. Data is ' + Math.round((now-data) / (1000 * 60)) + ' minutes old');
            return false;
        } else {
            return true;
        }
    }

    //If we don't have fiat information yet, perform a check
    async function updateFiatsInDOM(){
        if($.isEmptyObject(fiats)){
            console.log("Fetching list of all fiats");
            addMessage('Fetching list of all fiats');
            await $.ajax({
                url: 'https://api.exchangeratesapi.io/latest?base=USD',
                success: function(result){
                    console.log(result.rates);
                    let rates = result.rates;
                    $('#fiatSelect option').remove();

                    for(let prop in rates){
                        fiats[prop] = rates[prop];
                        $('#fiatSelect').append(new Option(prop, prop))
                    }
                    updateLocalstorage();
                    addMessage('Updated fiats');
                    return fiats;
                }
            });
        } else {
            for(let currency in fiats){
                $('#fiatSelect').append(new Option(currency, currency))
            }
            return fiats;
        }
    }

    //
    async function updateCryptosInDOM(){
        console.log('getting top cryptos');
        if(localStorageIsOutdated()){
            console.log("getting top cryptos in USD");
            addMessage('Getting top 100 cryptos');
            await $.ajax({
                url: url + '/coins/markets/?vs_currency=' + fiat.toLowerCase(),
                headers: {'Access-Control-Allow-Origin': '*' },
                success: function(result) {
                    let select = $('#coinSelect');
                    for(let i=0; i<result.length; i++){
                        let r = result[i];
                        select.append(new Option(r['name'] + ' (' + r['symbol'] + ')', r['id']))
                        topCryptos[i] = {
                                "text": r['name'] + ' (' + r['symbol'] + ')',
                                "value": r['id']
                            };
                    }
                    coin = $('#coinSelect').val();
                    updateLocalstorage();
                    addMessage('Updated top 100 cryptos');
                    return;
                }

            });
        } else {
            console.log('Getting saved coins from local storage')
            let select = $('#coinSelect');

            let i= 0;
            for (let key in topCryptos){
                let r = topCryptos[i];
                select.append(new Option(r['text'], r['value']));
                i++;
            }
            coin = $('#coinSelect').val();
        }
    }


    //Calculates how many percent a given coin (c) has grown each year
    //Updates the percentage change input field, to reflect this growth rate (arithmetic average)
    async function calculatePriceHistory(c, f){

        let d = new Date();
        let month = d.getMonth() + 1;
        let year = d.getFullYear();
        let date = d.getDate();

        let dateString = date+'-'+month+'-'+year;

        let doitAgain = true;
        let prices = [];
        const maxPrices = 10;
        let growth = [];
        let growthSum = 0;

        if(priceHistory.hasOwnProperty(c)){
            for(let i=0; i<priceHistory[c].length; i++){
                prices.push(priceHistory[c][i]);
            }
        } else {
            priceHistory[c] = [];
            addMessage('Calculates artimetric growth average for ' + c);
            while(doitAgain){
                await $.ajax({
                    url: url + '/coins/'+ c +'/history/?date=' + dateString,
                    headers: {'Access-Control-Allow-Origin': '*' },
                    success: function(result) {
                        if(result.hasOwnProperty('market_data')){
                            prices.push(result.market_data.current_price[f.toLowerCase()]);
                            year--;
                            dateString = date+'-'+month+'-'+year;
                            priceHistory[c].push(result.market_data.current_price[f.toLowerCase()]);

                            if(prices.length >= maxPrices) doitAgain = false;
                        } else {
                            doitAgain = false;
                        }
                    }

                });
            }
            console.log(priceHistory);
            addMessage('Finished calculating artimetric growth average for ' + c);
            updateLocalstorage();
        }


        if(prices.length < 2){
            $('#percentageInput').val(10);
            return;
        }

        for(let i=0; i<prices.length; i++){
            console.log(new Date().getFullYear() - i +  ': ' + prices[i]);

            if(i + 1==prices.length) break;

            growth[i] = (prices[i] - prices[i+1]) / prices[i+1];
            growthSum += growth[i];
        }
        let output = (growthSum / growth.length) * 100;
        $('#percentageInput').val(parseFloat(output.toString()).toFixed(2));
        updateForecastTable();
    }

    function addMessage(msg){
        $('#messageContainer').append('<span>'+msg+'</span>');
        setTimeout(function(){
            $('#messageContainer span:first-child').remove();
        }, 5000);
    }





























});