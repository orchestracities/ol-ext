/*	Copyright (c) 2019 Jean-Marc VIGLINO, 
  released under the CeCILL-B license (French BSD license)
  (http://www.cecill.info/licences/Licence_CeCILL-B_V1-en.txt).
*/

import ol_ext_inherits from '../util/ext'
import ol_style_Style from 'ol/style/Style'
import {asString as ol_color_asString} from 'ol/color'
import {asArray as ol_color_asArray} from 'ol/color'
import {ol_coordinate_dist2d} from '../geom/GeomUtils'

/** Flow line style
 * Draw LineString with a variable color / width
 * NB: the FlowLine style doesn't impress the hit-detection.
 * If you want your lines to be sectionable you have to add your own style to handle this.
 * (with transparent line: stroke color opacity to .1 or zero width)
 * @extends {ol_style_Style}
 * @constructor
 * @param {Object} options
 *  @param {boolean} options.visible draw only the visible part of the line, default true
 *  @param {number|function} options.width Stroke width or a function that gets a feature and the position (beetween [0,1]) and returns current width
 *  @param {number} options.width2 Final stroke width
 *  @param {number} options.arrow Arrow at start (-1), at end (1), at both (2), none (0), default geta
 *  @param {ol.colorLike|function} options.color Stroke color or a function that gets a feature and the position (beetween [0,1]) and returns current color
 *  @param {ol.colorLike} options.color2 Final sroke color
 */
var ol_style_FlowLine = function(options) {
  if (!options) options = {};
  
  ol_style_Style.call (this, { 
    renderer: this._render.bind(this),
    geometry: options.geometry
  });

  // Draw only visible
  this._visible = (options.visible !== false);

  // Width
  if (typeof options.width === 'function') {
    this._widthFn = options.width;
  } else {
    this.setWidth(options.width);
  }
  this.setWidth2(options.width2);
  // Color
  if (typeof options.color === 'function') {
    this._colorFn = options.color;
  } else {
    this.setColor(options.color);
  }
  this.setColor2(options.color2);
  // LineCap
  this.setLineCap(options.lineCap);
  // 
  this.setArrow(options.arrow);
};
ol_ext_inherits(ol_style_FlowLine, ol_style_Style);

/** Set the initial width
 * @param {number} width width, default 0
 */
ol_style_FlowLine.prototype.setWidth = function(width) {
  this._width = width || 0;
};

/** Set the final width
 * @param {number} width width, default 0
 */
ol_style_FlowLine.prototype.setWidth2 = function(width) {
  this._width2 = width;
};

/** Set the LineCap
 * @param {steing} cap LineCap (round or butt), default butt
 */
ol_style_FlowLine.prototype.setLineCap = function(cap) {
  this._lineCap = (cap==='round' ? 'round' : 'butt');
};

/** Get the current width at step
 * @param {ol.feature} feature
 * @param {number} step current drawing step beetween [0,1] 
 * @return {number} 
 */
ol_style_FlowLine.prototype.getWidth = function(feature, step) {
  if (this._widthFn) return this._widthFn(feature, step);
  var w2 = (typeof(this._width2) === 'number') ? this._width2 : this._width;
  return this._width + (w2-this._width) * step;
};

/** Set the initial color
 * @param {ol.colorLike} color
 */
ol_style_FlowLine.prototype.setColor = function(color) {
  try{
    this._color = ol_color_asArray(color);
  } catch(e) {
    this._color = [0,0,0,1];
  }
};

/** Set the final color
 * @param {ol.colorLike} color
 */
ol_style_FlowLine.prototype.setColor2 = function(color) {
  try {
    this._color2 = ol_color_asArray(color);
  } catch(e) {
    this._color2 = null;    
  }
};

/** Get the current color at step
 * @param {ol.feature} feature
 * @param {number} step current drawing step beetween [0,1] 
 * @return {string} 
 */
ol_style_FlowLine.prototype.getColor = function(feature, step) {
  if (this._colorFn) return ol_color_asString(this._colorFn(feature, step));
  var color = this._color;
  var color2 = this._color2 || this._color
  return 'rgba('+
          + Math.round(color[0] + (color2[0]-color[0]) * step) +','
          + Math.round(color[1] + (color2[1]-color[1]) * step) +','
          + Math.round(color[2] + (color2[2]-color[2]) * step) +','
          + (color[3] + (color2[3]-color[3]) * step)
          +')';
};

/** Get arrow
 */
ol_style_FlowLine.prototype.getArrow = function() {
  return this._arrow;
};

/** Set arrow
 * @param {number} n -1 | 0 | 1 | 2, default: 0
 */
ol_style_FlowLine.prototype.setArrow = function(n) {
  this._arrow = parseInt(n);
  if (this._arrow < -1 || this._arrow > 2) this._arrow = 0;
}

/** Renderer function
 * @param {Array<ol.coordinate>} geom The pixel coordinates of the geometry in GeoJSON notation
 * @param {ol.render.State} e The olx.render.State of the layer renderer
 */
ol_style_FlowLine.prototype._render = function(geom, e) {
  if (e.geometry.getType()==='LineString') {
    var i, p, ctx = e.context;
    // Get geometry used at drawing
    if (!this._visible) {
      var a = e.pixelRatio / e.resolution;
      var g = e.geometry.getCoordinates();
      var dx = geom[0][0] - g[0][0] * a;
      var dy = geom[0][1] + g[0][1] * a;
      geom = [];
      for (i=0; p=g[i]; i++) {
        geom[i] = [ dx + p[0] * a, dy - p[1] * a];
      }
    }
    // Split into
    var geoms = this._splitInto(geom, 255, 2);
    var k = 0;
    var nb = geoms.length;
    function drawArrow(p0, p1, width) {
      ctx.beginPath();
      ctx.moveTo(p0[0],p0[1]);
      var l = ol.coordinate.dist2d(p0, p1);
      var dx = (p0[0]-p1[0])/l;
      var dy = (p0[1]-p1[1])/l;
      width = Math.max(8, width/2);
      ctx.lineTo(p0[0]-16*dx+width*dy, p0[1]-16*dy-width*dx);
      ctx.lineTo(p0[0]-16*dx-width*dy, p0[1]-16*dy+width*dx);
      ctx.lineTo(p0[0],p0[1]);
      ctx.fill();
    }
    // Calculate arrow length
    var length = length0 = length1 = 0;
    if (this.getArrow()) {
      var p = geoms[0][0];
      for (i=1; i<geoms[0].length; i++) {
        length += ol.coordinate.dist2d(p,geoms[0][i])
        p = geoms[0][i]
      }
      switch (this.getArrow()) {
        case -1: {
          length0 = Math.round(16/length);
          break;
        }
        case 1: {
          length1 = Math.round(16/length);
          break;
        }
        case 2: {
          length0 = length1 = Math.round(16/length);
          break;
        }
      }
    }

    // Draw
    ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineCap = this._lineCap || 'butt';

      if ((length0 && geoms[length0]) || (length1 && geoms[length1])) {
        ctx.lineCap = 'butt';
        if (length0) {
          ctx.fillStyle = this.getColor(e.feature, 0);
          drawArrow(geoms[0][0], geoms[length0][geoms[length0].length-1], this.getWidth(e.feature, 0) * e.pixelRatio);
        }
        if (length1) {
          ctx.fillStyle = this.getColor(e.feature, 1);
          var g0 = geoms[geoms.length-1];
          var g1 = geoms[geoms.length-1-length1];
          drawArrow(g0[g0.length-1], g1[0], this.getWidth(e.feature, 1) * e.pixelRatio);
        }
      }

      for (k=length0; k<geoms.length-length1-1; k++) {
        var step = k/nb;
        var g = geoms[k];
        ctx.lineWidth = this.getWidth(e.feature, step) * e.pixelRatio;
        ctx.strokeStyle = this.getColor(e.feature, step);
        ctx.beginPath();
        ctx.moveTo(g[0][0],g[0][1]);
        for (i=1; p=g[i]; i++) {
          ctx.lineTo(p[0],p[1]);
          ctx.stroke();
        }
      }
    ctx.restore();
  }
};

/** Split line geometry into equal length geometries
 * @param {Array<ol.coordinate>} geom
 * @param {number} nb number of resulting geometries, default 255
 * @param {number} nim minimum length of the resulting geometries, default 1
 */
ol_style_FlowLine.prototype._splitInto = function(geom, nb, min) {
  var i, p;
  // Split geom into equal length geoms
  var geoms = [];
  var dl, l = 0;
  for (i=1; p=geom[i]; i++) {
    l += ol_coordinate_dist2d(geom[i-1], p);
  }
  var length = Math.max (min||2, l/(nb||255));
  var p0 = geom[0];
  l = 0;
  var g = [p0];
  i = 1;
  p = geom[1];
  while (i < geom.length) {
    var dx = p[0]-p0[0];
    var dy = p[1]-p0[1];
    dl = Math.sqrt(dx*dx + dy*dy);
    if (l+dl > length) {
      var d = (length-l) / dl;
      g.push([ 
        p0[0] + dx * d,  
        p0[1] + dy * d 
      ]);
      geoms.push(g);
      p0 =[ 
        p0[0] + dx * d*.9,  
        p0[1] + dy * d*.9
      ];
      g = [p0];
      l = 0;
    } else {
      l += dl;
      p0 = p;
      g.push(p0);
      i++;
      p = geom[i];
    }
  }
  geoms.push(g);
  return geoms;
}

export default ol_style_FlowLine
