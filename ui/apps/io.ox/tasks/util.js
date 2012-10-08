/**
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * Copyright (C) Open-Xchange Inc., 2011
 * Mail: info@open-xchange.com
 *
 * @author Daniel Dickhaus <daniel.dickhaus@open-xchange.com>
 */
define("io.ox/tasks/util", ['gettext!io.ox/tasks/util',
                            "io.ox/core/date"], function (gt, date) {
    
    "use strict";
    
    var lookupArray = [60000 * 5,           //five minutes
                       60000 * 15,          //fifteen minutes
                       60000 * 30,          //thirty minutes
                       60000 * 60],         //one hour]
                       
        lookupDaytimeStrings = ["this morning",
                                "by noon",
                                "this afternoon",
                                "tonight",
                                "late in the evening"],
                                
        lookupWeekdayStrings = ["on Sunday",
                                 "on Monday",
                                 "on Tuesday",
                                 "on Wednesday",
                                 "on Thursday",
                                 "on Friday",
                                 "on Saturday"];
    
    var util = {
            computePopupTime: function (time, finderId) {
                var endDate = new Date(time.getTime()),
                    weekDay = endDate.getDay(),
                    alarmDate = new Date(time.getTime());
                
                switch (finderId) {
                case "0":
                case "1":
                case "2":
                case "3":
                    alarmDate.setTime(alarmDate.getTime() + lookupArray[finderId]);
                    break;
                default:
                    alarmDate.setTime(prepareTime(alarmDate));
                    switch (finderId) {
                    case "d0":
                        alarmDate.setHours(6);
                        break;
                    case "d1":
                        alarmDate.setHours(12);
                        break;
                    case "d2":
                        alarmDate.setHours(15);
                        break;
                    case "d3":
                        alarmDate.setHours(18);
                        break;
                    case "d4":
                        alarmDate.setHours(22);
                        break;
                    default:
                        alarmDate.setHours(6);
                        switch (finderId) {
                        case "t":
                            alarmDate.setTime(alarmDate.getTime() + 60000 * 60 * 24);
                            break;
                        case "ww":
                            alarmDate.setTime(alarmDate.getTime() + 60000 * 60 * 24 * 7);
                            break;
                        case "w0":
                            var day = alarmDate.getDay() % 7;
                            alarmDate.setTime(alarmDate.getTime() + 60000 * 60 * 24 * (7 - day));
                            break;
                        case "w1":
                            var day = (((alarmDate.getDay() - 1) % 7) + 7) % 7;//workaround: javascript modulo operator to stupid to handle negative numbers
                            alarmDate.setTime(alarmDate.getTime() + 60000 * 60 * 24 * (7 - day));
                            break;
                        case "w2":
                            var day = (((alarmDate.getDay() - 2) % 7) + 7) % 7;
                            alarmDate.setTime(alarmDate.getTime() + 60000 * 60 * 24 * (7 - day));
                            break;
                        case "w3":
                            var day = (((alarmDate.getDay() - 3) % 7) + 7) % 7;
                            alarmDate.setTime(alarmDate.getTime() + 60000 * 60 * 24 * (7 - day));
                            break;
                        case "w4":
                            var day = (((alarmDate.getDay() - 4) % 7) + 7) % 7;
                            alarmDate.setTime(alarmDate.getTime() + 60000 * 60 * 24 * (7 - day));
                            break;
                        case "w5":
                            var day = (((alarmDate.getDay() - 5) % 7) + 7) % 7;
                            alarmDate.setTime(alarmDate.getTime() + 60000 * 60 * 24 * (7 - day));
                            break;
                        case "w6":
                            var day = (((alarmDate.getDay() - 6) % 7) + 7) % 7;
                            alarmDate.setTime(alarmDate.getTime() + 60000 * 60 * 24 * (7 - day));
                            break;
                        default:
                            //cannot identify selector...set time now
                            //maybe errormessage
                            alarmDate = new Date();
                            break;
                        }
                        break;
                    }
                    break;
                }
                
                endDate.setTime(prepareTime(endDate));
                endDate.setHours(6);
                if (weekDay < 1 || weekDay > 4) {
                    weekDay = (((endDate.getDay() - 1) % 7) + 7) % 7;
                    endDate.setTime(endDate.getTime() + 60000 * 60 * 24 * (7 - weekDay));
                } else {
                    weekDay = (((endDate.getDay() - 5) % 7) + 7) % 7;
                    endDate.setTime(endDate.getTime() + 60000 * 60 * 24 * (7 - weekDay));
                }
                
                if (alarmDate.getTime() > endDate.getTime()) {//endDate should not be before alarmDate
                    endDate.setTime(endDate.getTime() + 60000 * 60 * 24 * 7);
                }
                var result = {
                        endDate: endDate,
                        alarmDate: alarmDate
                    };
                return result;
            },
    
            //builds dropdownmenu nodes, if bootstrapDropdown is set listnodes are created else option nodes
            buildDropdownMenu: function (time, bootstrapDropdown) {
                if (!time) {
                    time = new Date();
                }
                
                //normal times
                var appendString = "<option finderId='0'>" + gt('in 5 minutes') + "</option>" +
                "<option finderId='1'>" + gt('in 15 minutes') + "</option>" +
                "<option finderId='2'>" + gt('in 30 minutes') + "</option>" +
                "<option finderId='3'>" + gt('in one hour') + "</option>";
                
                // variable daytimes
                var i = time.getHours(),
                    temp;
                
                if (i < 6) {
                    i = 0;
                } else if (i < 12) {
                    i = 1;
                } else if (i < 15) {
                    i = 2;
                } else if (i < 18) {
                    i = 3;
                } else if (i < 22) {
                    i = 4;
                }
                
                while (i < lookupDaytimeStrings.length) {
                    temp = lookupDaytimeStrings[i];
                    appendString = appendString + "<option finderId='d" + i + "'>" + gt(temp) + "</option>";
                    i++;
                }
                
                //weekdays
                var circleIncomplete = true,
                    startday = time.getDay();
                
                i = (time.getDay() + 2) % 7;
                
                appendString = appendString + "<option finderId='t'>" + gt("tomorrow") + "</option>";
                
                while (circleIncomplete) {
                    temp = lookupWeekdayStrings[i];
                    appendString = appendString + "<option finderId='w" + i + "'>" + gt(temp) + "</option>";
                    if (i < 6) {
                        i++;
                    } else {
                        i = 0;
                    }
                    
                    if (i === startday) {
                        appendString = appendString + "<option finderId='ww'>" + gt("in one week") + "</option>";
                        circleIncomplete = false;
                    }
                }
                
                if (bootstrapDropdown) {
                    appendString = appendString.replace(/<option/g, "<li><a href='#'");
                    appendString = appendString.replace(/option>/g, "a></li>");
                }
                
                return appendString;
            },
            
            //change status number to status text. format enddate to presentable string
            //if detail alarm and startdate get converted too and status text is set for more states than overdue and success
            interpretTask: function (task, detail)
            {
                task = _.copy(task, true);
                if (task.status === 3) {
                    task.status = gt("Done");
                    task.badge = "badge badge-success";
                    
                } else {
                    
                    var now = new Date();
                    if (task.end_date !== undefined && task.end_date !== null && now.getTime() > task.end_date) {//no state for task over time, so manual check is needed
                        task.status = gt("Over due");
                        task.badge = "badge badge-important";
                    } else if (detail && task.status) {
                        switch (task.status) {
                        case 1:
                            task.status = gt("Not started");
                            task.badge = "badge";
                            break;
                        case 2:
                            task.status = gt("In progress");
                            task.badge = "badge";
                            break;
                        case 4:
                            task.status = gt("Waiting");
                            task.badge = "badge";
                            break;
                        case 5:
                            task.status = gt("Deferred");
                            task.badge = "badge";
                            break;
                        }
                    } else {
                        task.status = '';
                        task.badge = '';
                    }
                }
                
                

                if (task.title === undefined || task.title === null) {
                    task.title = '\u2014';
                }
                
                if (task.end_date !== undefined && task.end_date !== null) {
                    task.end_date = new date.Local(task.end_date).format();
                } else {
                    task.end_date = '';
                }
                
                if (detail) {
                    if (task.start_date !== undefined && task.start_date !== null) {
                        task.start_date = new date.Local(task.start_date).format();
                    } else {
                        task.start_date = '';
                    }
                    
                    if (task.alarm !== undefined && task.alarm !== null) {
                        task.alarm = new date.Local(task.alarm).format();
                    } else {
                        task.alarm = '';
                    }
                }
                
                return task;
            },
            
            sortTasks: function (tasks, order) {//done tasks last, overduetasks first, same date alphabetical
                tasks = _.copy(tasks, true);//make local copy
                if (!order) {
                    order = 'asc';
                }
                
                var resultArray = [],
                    alphabetArray = [];
                
                for (var i = 0; i < tasks.length; i++) {
                    if (tasks[i].status === 3) {
                        resultArray.push(tasks[i]);
                    } else {
                        alphabetArray.push(tasks[i]);
                    }
                }
                
                alphabetArray.sort(function (a, b) {
                        if (a.end_date > b.end_date || a.end_date === null) {
                            return 1;
                        } else if (a.end_date < b.end_date || b.end_date === null) {
                            return -1;
                        } else if (a.title > b.title) {
                            return 1;
                        } else {
                            return -1;
                        }
                    });
                if (order === 'desc') {
                    resultArray.push(alphabetArray);
                } else {
                    resultArray.unshift(alphabetArray);
                }
                return _.flatten(resultArray);
            }
            
        };
        
    var prepareTime = function (time) {
        time.setMilliseconds(0);
        time.setSeconds(0);
        time.setMinutes(0);
            
        return time;
    };
        
    return util;
});