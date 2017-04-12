/*
 * This script is injected into *every* page.
 * We probably want to add Jose crypto here as we can't get access to
 * the crypto APIs otherwise.
 */

function mozilla_heatmap_guid() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
        .toString(16)
        .substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
        s4() + '-' + s4() + s4() + s4();
}

/*
 * This injects a meta tag with the name and id of 'mozilla-heatmpa-tabident'
 * with a GUID as the node content.  This allows us to unambiguously determine
 * the identity of each tab in the case that heatmap misses some tab
 * manipulation events.
 *
 */
function inject_meta_tabident() {
    // check if the tag already exists, if it does - short circuit
    // and return the content
    var tabident_node = document.getElementById('mozilla-heatmap-tabident');
    if (tabident_node) {
        return tabident_nodes[0].content;
    }

    var meta = document.createElement('meta');
    meta.name = "mozilla-heatmap-pageident";
    meta.id = "mozilla-heatmap-pageident";
    meta.content = mozilla_heatmap_guid();

    document.getElementsByTagName('head')[0].appendChild(meta);
    return meta.content;
}


var myPort = browser.runtime.connect({name:"port-from-cs"});

function main() {
    var page_guid = inject_meta_tabident();

    // Send init message to the background script
    myPort.postMessage({page_ident: page_guid, url: document.URL});
}

main();
