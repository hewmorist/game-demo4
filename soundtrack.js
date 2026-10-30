// SoundCloud's official Widget API; no audio is downloaded or rehosted.
export function createSoundtrack(onPause){
 const status=document.getElementById('soundtrackStatus'),enabled=document.getElementById('soundtrackSync');
 let widget=null,ready=false,playing=false,pending=null,timer=null;
 function settle(ok){clearTimeout(timer);timer=null;const done=pending;pending=null;if(done)done(ok);}
 function pause(){const active=playing||pending;playing=false;settle(false);if(active&&widget)widget.pause();}
 function init(){if(!window.SC?.Widget){status.textContent='SoundCloud could not load. Reload, or turn off track sync to preview without audio.';return;}widget=window.SC.Widget(document.getElementById('soundtrackPlayer'));const E=window.SC.Widget.Events;
 widget.bind(E.READY,()=>{widget.getCurrentSound(sound=>{if(Number(sound?.id)!==2401193031){status.textContent='SoundCloud has not loaded Eigenbeing. Check the player, or turn off track sync.';return;}widget.getDuration(duration=>{if(!Number.isFinite(duration)||duration<=0){status.textContent='SoundCloud has not loaded the track duration. Reload the player.';return;}ready=true;status.textContent='Track ready. Play from start begins at 0:00.';});});});
 widget.bind(E.PLAY,()=>{playing=true;status.textContent='Eigenbeing playing.';settle(true);});
 widget.bind(E.PAUSE,()=>{if(pending)return;playing=false;settle(false);status.textContent='Track paused.';onPause();});
 widget.bind(E.FINISH,()=>{playing=false;settle(false);status.textContent='Track finished.';onPause();});
 widget.bind(E.ERROR,()=>{ready=false;pause();status.textContent='SoundCloud could not play this track. Check the player, or turn off track sync.';onPause();});
 }
 const script=document.createElement('script');script.src='https://w.soundcloud.com/player/api.js';script.onload=init;script.onerror=init;document.head.append(script);
 enabled.onchange=()=>{if(!enabled.checked)pause();};
 return {pause,startAt(seconds){if(!enabled.checked)return Promise.resolve(true);if(!ready){status.textContent='Wait for the SoundCloud player to load, then press Play again.';return Promise.resolve(false);}pause();return new Promise(resolve=>{pending=resolve;status.textContent='Starting Eigenbeing…';timer=setTimeout(()=>{pause();status.textContent='Tap Play in the SoundCloud player to enable audio, then press Play in the app.';onPause();},8000);widget.seekTo(Math.max(0,seconds)*1000);widget.play();});}};
}
