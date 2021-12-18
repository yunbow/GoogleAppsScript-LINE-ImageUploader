/**
 * 画像アップロードBOT
 */
const LINE_CHANNEL_TOKEN = '*****'; // LINE NOTIFYのアクセストークン
const SSID = '*****';
const SSN_USER = 'user';
const SSN_HISTORY = 'history';
const DFID = '*****'

let spreadsheet = SpreadsheetApp.openById(SSID);
let userSheet = spreadsheet.getSheetByName(SSN_USER);
let historySheet = spreadsheet.getSheetByName(SSN_HISTORY);
let folder = DriveApp.getFolderById(DFID);

/**
 * POSTリクエスト
 * @param {Object} event 
 */
function doPost(event) {
    try {
        if (event.postData) {
            let reqObj = JSON.parse(event.postData.contents);
            execute(reqObj);
        }
    } catch (e) {
        console.error(e.stack);
    }
}

/**
 * イベント処理
 * @param {Object} reqObj 
 */
function execute(reqObj) {

    for (let i in reqObj.events) {
        let reqEvent = reqObj.events[i];
        console.log(reqEvent);

        switch (reqEvent.type) {
            case 'follow':
                executeFollow(reqEvent);
                break;
            case 'unfollow':
                executeUnfollow(reqEvent);
                break;
            case 'message':
                executeMessage(reqEvent);
                break;
        }
    }
}

/**
 * Followイベント処理
 * @param {Object} reqEvent 
 */
function executeFollow(reqEvent) {
    let msgList = [{
        'type': 'text',
        'text': '写真コンテストの画像をアップロードできます',
    }];
    sendLinePush(reqEvent.source.userId, msgList);

    let user = getUser(reqEvent.source.userId);
    if (user) {
        userSheet.getRange(user.index + 2, 3).setValue(1);
    } else {
        userSheet.appendRow([reqEvent.source.type, reqEvent.source.userId, 1]);
    }
}

/**
 * UnFollowイベント
 * @param {Object} reqEvent 
 */
function executeUnfollow(reqEvent) {
    let user = getUser(reqEvent.source.userId);
    if (user) {
        userSheet.getRange(user.index + 2, 3).setValue(0);
    }
}

/**
 * メッセージイベント処理
 * @param {Object} reqEvent 
 */
function executeMessage(reqEvent) {
    let msgList = [];
    let user = getUser(reqEvent.source.userId);
    if (user) {
        switch (reqEvent.message.type) {
            case 'image':
                let childFolder = getChildFolder(reqEvent.source.userId);
                if (!childFolder) {
                    childFolder = folder.createFolder(reqEvent.source.userId);
                }

                let response = getLineContent(reqEvent.message.id);
                let file = response.getBlob();
                let timestamp = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMddHHmmss');
                file.setName(timestamp);
                childFolder.createFile(file);

                msgList.push({
                    'type': 'text',
                    'text': '写真承りました。',
                });
                sendLineReply(reqEvent.replyToken, msgList);
                break;
        }
    }
}

/**
 * サブフォルダーを取得する
 * @param {String} folderName 
 */
function getChildFolder(folderName) {
    let childFolders = folder.getFolders();
    while (childFolders.hasNext()) {
        let childFolder = childFolders.next();
        if (childFolder.getName() == folderName) {
            return childFolder;
        }
    }
    return null;
}

/**
 * ユーザーを取得する
 * @param {String} userId 
 */
function getUser(userId) {
    let userList = getUserList();
    for (let i in userList) {
        let user = userList[i];
        if (user.userId === userId) {
            return {
                index: parseInt(i),
                item: user
            };
        }
    }
    return null;
}

/**
 * ユーザー一覧を取得する
 */
function getUserList() {
    let userList = [];
    let lastRow = userSheet.getLastRow();
    if (1 < lastRow) {
        userList = userSheet.getRange(2, 1, lastRow, 3).getValues();
        userList = userList.map((row) => {
            return {
                type: row[0],
                userId: row[1],
                follow: row[2],
            }
        });
    }
    return userList;
}

/**
 * LINEからコンテンツを取得する
 * @param {String} messageId メッセージID
 */
function getLineContent(messageId) {
    let url = `https://api.line.me/v2/bot/message/${messageId}/content`;
    let options = {
        'method': 'get',
        'headers': {
            'Content-Type': 'application/json; charset=UTF-8',
            'Authorization': `Bearer ${LINE_CHANNEL_TOKEN}`
        }
    };
    return UrlFetchApp.fetch(url, options);
}

/**
 * LINEにメッセージを送信する
 * @param {String} targetId ターゲットID（userId/groupId/roomId）
 * @param {Object} msgList メッセージリスト
 */
function sendLinePush(targetId, msgList) {
    let url = 'https://api.line.me/v2/bot/message/push';
    let options = {
        'method': 'post',
        'headers': {
            'Content-Type': 'application/json; charset=UTF-8',
            'Authorization': `Bearer ${LINE_CHANNEL_TOKEN}`
        },
        'payload': JSON.stringify({
            to: targetId,
            messages: msgList
        })
    };
    let response = UrlFetchApp.fetch(url, options);
    return JSON.parse(response.getContentText('UTF-8'));
}

/**
 * LINEに応答メッセージを送信する
 * @param {String} replyToken リプライトークン
 * @param {Object} msgList メッセージリスト
 */
function sendLineReply(replyToken, msgList) {
    let url = 'https://api.line.me/v2/bot/message/reply';
    let options = {
        'method': 'post',
        'headers': {
            'Content-Type': 'application/json; charset=UTF-8',
            'Authorization': `Bearer ${LINE_CHANNEL_TOKEN}`
        },
        'payload': JSON.stringify({
            replyToken: replyToken,
            messages: msgList
        })
    };
    let response = UrlFetchApp.fetch(url, options);
    return JSON.parse(response.getContentText('UTF-8'));
}